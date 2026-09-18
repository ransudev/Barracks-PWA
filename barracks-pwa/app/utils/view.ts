import { administratorOnlyViews, adminViews, managementOnlyViews } from "@/app/constants/navigation";
import type { ViewId } from "@/app/types/domain";

export function isAdminView(view: ViewId) {
  return adminViews.includes(view);
}

export function requiresAdministrator(view: ViewId) {
  return administratorOnlyViews.includes(view);
}

export function requiresManagement(view: ViewId) {
  return managementOnlyViews.includes(view);
}
