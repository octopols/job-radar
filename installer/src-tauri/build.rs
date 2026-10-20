fn main() {
	println!("cargo:rerun-if-env-changed=JOB_RADAR_PAYLOAD");
	println!("cargo:rerun-if-env-changed=JOB_RADAR_UNPACKED_BYTES");
	println!("cargo:rerun-if-env-changed=JOB_RADAR_VERSION");
	tauri_build::build();
}
