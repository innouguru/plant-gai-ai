import { request } from "./client";

export function completeOnboarding(farmName, token) {
  return request("/onboarding", {
    method: "POST",
    body: { farm_name: farmName },
    token,
  });
}