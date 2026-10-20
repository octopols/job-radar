import type { Applicant } from "@shared/types/application.ts";
import type { SeekerSnapshot } from "@shared/types/seeker.ts";

export class ApplicantDefaults {
	static prefilledFrom(snapshot: SeekerSnapshot): Applicant {
		if (snapshot.applicant) {
			return snapshot.applicant;
		}
		const contact = snapshot.resumeContact;
		const workCountries = snapshot.profile?.workCountries ?? [];
		return {
			fullName: contact?.fullName ?? "",
			email: contact?.email ?? "",
			phone: contact?.phone ?? "",
			location: snapshot.profile?.locations[0] ?? "",
			linkedinUrl: contact?.linkedinUrl ?? "",
			websiteUrl: contact?.websiteUrl ?? "",
			workAuthorization: ApplicantDefaults.#workAuthorization(workCountries),
			noticePeriod: "",
			salaryExpectation: "",
			otherFacts: "",
			pastEmployers: contact?.employers.join(", ") ?? "",
			veteran: "no",
			disability: "no",
			gender: "",
			ethnicity: "",
			over18: true,
			nonCompete: false,
			heardFrom: "Company careers page",
		};
	}

	static #workAuthorization(workCountries: string[]): string {
		return workCountries.length > 0 ? `Authorized to work in ${workCountries.join(" and ")}. Would need visa sponsorship elsewhere.` : "";
	}
}
