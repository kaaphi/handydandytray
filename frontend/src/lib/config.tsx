import { DefaultConfigService } from "../../bindings/handydandytray/internal/services";
import { queryClient } from "./queryClient";

export const refreshConfig = () => {
    DefaultConfigService.Reload()
    queryClient.invalidateQueries()
    console.log("Refreshed config!")
}