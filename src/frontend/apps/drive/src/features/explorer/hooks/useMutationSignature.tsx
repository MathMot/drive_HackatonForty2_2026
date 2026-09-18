import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAPI } from "@/features/api/fetchApi";
import { addToast } from "@/features/ui/components/toaster/Toaster";
import { ToasterItem } from "@/features/ui/components/toaster/Toaster";


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
      const response = await fetchAPI(`items/${itemId}/request-sign/`, {
        method: "POST",
        body: JSON.stringify({ signers, suffix, is_self_sign: false }),
      });
      
      
      return response.json();
    },
    
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
      queryClient.invalidateQueries({ queryKey: ["item", variables.itemId] });

      addToast(
        <ToasterItem type="info">
            <span className="material-icons">draw</span>
            <span>Le document a été envoyé</span>
        </ToasterItem>,
        );
    },
  });
};