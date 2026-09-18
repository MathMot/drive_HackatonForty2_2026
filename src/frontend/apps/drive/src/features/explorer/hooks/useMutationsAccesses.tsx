import { getDriver } from "@/features/config/Config";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAPI } from "@/features/api/fetchApi";
import { APIError } from "@/features/api/APIError";
import { useOnSuccessAccessOrInvitationMutation } from "./useRefreshItems";
import { addToast } from "@/features/ui/components/toaster/Toaster";
import { ToasterItem } from "@/features/ui/components/toaster/Toaster";


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

export const useMutationBatchSign = () => {
  const driver = getDriver();
  const onSuccessAccessOrInvitation = useOnSuccessAccessOrInvitationMutation();
  return useMutation({
    // Errors are displayed inside the import modal, not by the global toast
    meta: { noGlobalError: true },
    mutationFn: (...payload: Parameters<typeof driver.batchSign>) => {
      return driver.batchSign(...payload);
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

export const useMutationSelfSign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      itemId,
      zone,
      suffix,
    }: {
      itemId: string;
      zone: any;
      suffix?: string;
    }) => {
      const response = await fetchAPI(
        `items/${itemId}/self-sign/`,
        {
          method: "POST",
          body: JSON.stringify({ zone, suffix, is_self_sign: true }),
        },
      );


      return response.json();
    },
    onSuccess: (data, variables) => {
      if (data.signed == 0) {
      addToast(
        <ToasterItem type="info">
            <span className="material-icons">draw</span>
            <span>Signature réussie !</span>
        </ToasterItem>,
        );
      } else {
      addToast(
        <ToasterItem type="error">
            <span className="material-icons">draw</span>
            <span>Impossible de signer le document : Vous avez déjà signé...</span>
        </ToasterItem>,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["item", variables.itemId] });
    },

    

    
  });

  
  
};

export const useMutationExecuteSign = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      itemId,
      zone,
    }: {
      itemId: string;
      zone?: any;
    }) => {
      const response = await fetchAPI(
        `items/${itemId}/self-sign/`,
        {
          method: "POST",
          body: JSON.stringify({ zone }),
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

