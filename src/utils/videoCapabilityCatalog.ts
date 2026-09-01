import axios from "@/utils/axios";
import type { VideoCapabilityCatalogVendor } from "@/videoContract";

let cachedCatalog: VideoCapabilityCatalogVendor[] | null = null;

export async function getVideoCapabilityCatalog(refresh = false): Promise<VideoCapabilityCatalogVendor[]> {
  if (!refresh && cachedCatalog) return cachedCatalog;
  const { data } = await axios.post("/modelSelect/getVideoCapabilityCatalog");
  cachedCatalog = data as VideoCapabilityCatalogVendor[];
  return cachedCatalog;
}
