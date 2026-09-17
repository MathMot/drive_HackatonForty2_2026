import { getDriver } from "@/features/config/Config";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAPI } from "@/features/api/fetchApi";
import { APIError } from "@/features/api/APIError";
import { useOnSuccessAccessOrInvitationMutation } from "./useRefreshItems";

// ============================================================================
// ACCESS & INVITATION MUTATIONS
// ============================================================================

export const useMutationCreateAccess = () => {
  const driver = getDriver();
  const onSuccessAccessOrInvitation = useOnSuccessAccessOrInvitationMutation();
  return useMutation({
    mutationFn: (...payload: Parameters<typeof driver.createAccess>) => {
      return driver.createAccess(...payload);
    },
    onSuccess: (_, variables) => {
      onSuccessAccessOrInvitation(variables.itemId, false);
    },
  });
};

export const useMutationBatchShare = () => {
  const driver = getDriver();
  const onSuccessAccessOrInvitation = useOnSuccessAccessOrInvitationMutation();
  return useMutation({
    // Errors are displayed inside the import modal, not by the global toast
    meta: { noGlobalError: true },
    mutationFn: (...payload: Parameters<typeof driver.batchShare>) => {
      return driver.batchShare(...payload);
    },
    onSuccess: (_, variables) => {
      // A batch can create both accesses and invitations
      onSuccessAccessOrInvitation(variables.itemId, false);
      onSuccessAccessOrInvitation(variables.itemId, true);
    },
  });
};

export const useMutationCreateInvitation = () => {
  const driver = getDriver();
  const onSuccessAccessOrInvitation = useOnSuccessAccessOrInvitationMutation();

  return useMutation({
    mutationFn: (...payload: Parameters<typeof driver.createInvitation>) => {
      return driver.createInvitation(...payload);
    },
    onSuccess: (_, variables) => {
      onSuccessAccessOrInvitation(variables.itemId, true);
    },
  });
};

export const useMutationUpdateInvitation = () => {
  const driver = getDriver();

  const onSuccessAccessOrInvitation = useOnSuccessAccessOrInvitationMutation();
  return useMutation({
    mutationFn: (...payload: Parameters<typeof driver.updateInvitation>) => {
      return driver.updateInvitation(...payload);
    },
    onSuccess: (_, variables) => {
      onSuccessAccessOrInvitation(variables.itemId, true);
    },
  });
};

export const useMutationUpdateAccess = () => {
  const driver = getDriver();
  const onSuccessAccessOrInvitation = useOnSuccessAccessOrInvitationMutation();
  return useMutation({
    mutationFn: (...payload: Parameters<typeof driver.updateAccess>) => {
      return driver.updateAccess(...payload);
    },
    onSuccess: (_data, variables) => {
      onSuccessAccessOrInvitation(variables.itemId, false);
    },
  });
};

export const useMutationDeleteAccess = () => {
  const driver = getDriver();
  const onSuccessAccessOrInvitation = useOnSuccessAccessOrInvitationMutation();
  return useMutation({
    mutationFn: (...payload: Parameters<typeof driver.deleteAccess>) => {
      return driver.deleteAccess(...payload);
    },
    onSuccess: (_, variables) => {
      onSuccessAccessOrInvitation(variables.itemId, false);
    },
  });
};

export const useMutationDeleteInvitation = () => {
  const driver = getDriver();
  const onSuccessAccessOrInvitation = useOnSuccessAccessOrInvitationMutation();
  return useMutation({
    mutationFn: (...payload: Parameters<typeof driver.deleteInvitation>) => {
      return driver.deleteInvitation(...payload);
    },
    onSuccess: (_, variables) => {
      onSuccessAccessOrInvitation(variables.itemId, true);
    },
  });
};

export const useMutationSign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      itemId,
      zone,
      is_self_sign = false,
      suffix,
    }: {
      itemId: string;
      zone: any;
      is_self_sign?: boolean;
      suffix?: string;
    }) => {
      const response = await fetchAPI(
        `items/${itemId}/sign/`,
        {
          method: "POST",
          body: JSON.stringify({ zone, is_self_sign, suffix }),
        },
      );
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["item", variables.itemId] });
    },
  });
};

export const useMutationRequestSign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      itemId,
      signers,
      suffix,
    }: {
      itemId: string;
      signers: string[];
      suffix?: string;
    }) => {
      const response = await fetchAPI(
        `items/${itemId}/request-sign/`,
        {
          method: "POST",
          body: JSON.stringify({ signers, suffix, is_self_sign: false }),
        },
      );
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["item", variables.itemId] });
    },
  });
};
