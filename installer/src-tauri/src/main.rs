#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

const PAYLOAD: &[u8] = include_bytes!(env!("JOB_RADAR_PAYLOAD"));
const UNPACKED_BYTES: &str = env!("JOB_RADAR_UNPACKED_BYTES");
const VERSION: &str = env!("JOB_RADAR_VERSION");
const UNINSTALL_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\254184f5-585d-5c6c-8882-5b9023794fc8";
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const PROGRESS_INTERVAL: Duration = Duration::from_millis(250);

#[derive(Clone, Copy, PartialEq)]
enum Scope {
	User,
	Machine,
}

impl Scope {
	fn parse(value: &str) -> Result<Self, String> {
		match value {
			"user" => Ok(Scope::User),
			"machine" => Ok(Scope::Machine),
			other => Err(format!("unknown install scope `{other}`")),
		}
	}

	fn registry_root(self) -> &'static str {
		match self {
			Scope::User => "HKCU",
			Scope::Machine => "HKLM",
		}
	}

	fn default_dir(self) -> PathBuf {
		match self {
			Scope::User => PathBuf::from(env("LOCALAPPDATA")).join("Programs").join("job-radar"),
			Scope::Machine => PathBuf::from(env("ProgramFiles")).join("Job Radar"),
		}
	}
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SetupInfo {
	version: &'static str,
	installed_version: Option<String>,
	user_dir: String,
	machine_dir: String,
}

#[derive(Serialize, Clone)]
struct Progress {
	fraction: f64,
}

fn env(name: &str) -> String {
	std::env::var(name).unwrap_or_default()
}

fn registry_value(root: &str, name: &str) -> Option<String> {
	let output = Command::new("reg")
		.args(["query", &format!(r"{root}\{UNINSTALL_KEY}"), "/v", name])
		.creation_flags(CREATE_NO_WINDOW)
		.output()
		.ok()?;
	let text = String::from_utf8_lossy(&output.stdout);
	let line = text.lines().find(|line| line.trim_start().starts_with(name))?;
	line.split("REG_SZ").nth(1).map(|value| value.trim().to_string())
}

fn installed_version() -> Option<String> {
	registry_value("HKCU", "DisplayVersion").or_else(|| registry_value("HKLM", "DisplayVersion"))
}

fn directory_size(path: &Path) -> u64 {
	let Ok(entries) = fs::read_dir(path) else {
		return 0;
	};
	entries
		.flatten()
		.map(|entry| match entry.metadata() {
			Ok(metadata) if metadata.is_dir() => directory_size(&entry.path()),
			Ok(metadata) => metadata.len(),
			Err(_) => 0,
		})
		.sum()
}

#[tauri::command]
fn info() -> SetupInfo {
	SetupInfo {
		version: VERSION,
		installed_version: installed_version(),
		user_dir: Scope::User.default_dir().display().to_string(),
		machine_dir: Scope::Machine.default_dir().display().to_string(),
	}
}

#[tauri::command]
async fn install(app: AppHandle, scope: String) -> Result<String, String> {
	let scope = Scope::parse(&scope)?;
	tauri::async_runtime::spawn_blocking(move || run_installer(&app, scope))
		.await
		.map_err(|error| error.to_string())?
}

fn run_installer(app: &AppHandle, scope: Scope) -> Result<String, String> {
	let work_dir = std::env::temp_dir().join(format!("job-radar-setup-{VERSION}"));
	fs::create_dir_all(&work_dir).map_err(|error| format!("Could not prepare the installer: {error}"))?;
	let installer = work_dir.join("JobRadar-Installer.exe");
	fs::write(&installer, PAYLOAD).map_err(|error| format!("Could not prepare the installer: {error}"))?;

	let target = scope.default_dir();
	let expected = UNPACKED_BYTES.parse::<f64>().unwrap_or(0.0).max(1.0);
	let done = Arc::new(AtomicBool::new(false));
	let watcher = {
		let done = Arc::clone(&done);
		let app = app.clone();
		let target = target.clone();
		thread::spawn(move || {
			while !done.load(Ordering::Relaxed) {
				let fraction = (directory_size(&target) as f64 / expected).min(0.97);
				let _ = app.emit("progress", Progress { fraction });
				thread::sleep(PROGRESS_INTERVAL);
			}
		})
	};

	let status = match scope {
		Scope::User => Command::new(&installer).args(["/S", "/currentuser"]).creation_flags(CREATE_NO_WINDOW).status(),
		Scope::Machine => Command::new("powershell")
			.args([
				"-NoProfile",
				"-Command",
				&format!(
					"$p = Start-Process -FilePath '{}' -ArgumentList '/S','/allusers' -Verb RunAs -Wait -PassThru; exit $p.ExitCode",
					installer.display()
				),
			])
			.creation_flags(CREATE_NO_WINDOW)
			.status(),
	};
	done.store(true, Ordering::Relaxed);
	let _ = watcher.join();
	let _ = fs::remove_file(&installer);

	match status {
		Ok(status) if status.success() => {
			let _ = app.emit("progress", Progress { fraction: 1.0 });
			let location = registry_value(scope.registry_root(), "InstallLocation").map(PathBuf::from).unwrap_or(target);
			Ok(location.display().to_string())
		}
		Ok(_) if scope == Scope::Machine => Err("Installing for everyone needs administrator approval. Try again and choose Yes, or install just for you.".into()),
		Ok(status) => Err(format!("The installer stopped with code {}. Close Job Radar if it is running, then try again.", status.code().unwrap_or(-1))),
		Err(error) => Err(format!("Could not start the installer: {error}")),
	}
}

#[tauri::command]
fn launch(dir: String) -> Result<(), String> {
	Command::new(Path::new(&dir).join("Job Radar.exe"))
		.spawn()
		.map(|_| ())
		.map_err(|error| format!("Could not open Job Radar: {error}"))
}

fn main() {
	tauri::Builder::default()
		.invoke_handler(tauri::generate_handler![info, install, launch])
		.run(tauri::generate_context!())
		.expect("the setup window failed to start");
}
