import { UseMutateFunction, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Config, DefaultConfigService } from "../../bindings/handydandytray/internal/services"

export type UseConfigReturnValue = {
    config?: Config|null,
    reload: UseMutateFunction<void, Error, void, unknown>,
}

export const useConfig = (): UseConfigReturnValue => {
    const queryClient = useQueryClient();

    const config = useQuery({
        queryKey: ["config"],
        queryFn: DefaultConfigService.Config,
        //If we have multiple windows accessing this data, we'll have to emit an event for other windows to listen to so they can invalidate their cache
        staleTime: Infinity,
    })

    const reload = useMutation({
        mutationFn: DefaultConfigService.Reload,
        onSuccess: () => queryClient.invalidateQueries() //invalidate everything
    })

    return {
        config: config.data,
        reload: reload.mutate,
    }
}