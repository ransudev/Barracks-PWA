import { adminViews } from "@/app/constants/navigation";
import type { ViewId } from "@/app/types/domain";

export function isAdminView(view: ViewId) {
  return adminViews.includes(view);
}
