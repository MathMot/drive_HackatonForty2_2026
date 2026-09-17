// import { Button, Modal, ModalSize } from "@gouvfr-lasuite/ui-components";
import { Button, Modal, ModalSize, DataGrid } from "@gouvfr-lasuite/ui-components";
import { Circle, CircleCheck } from "@gouvfr-lasuite/ui-components/icons";
import { useTranslation } from "react-i18next";
import { Item } from "@/features/drivers/types";
import { useQuery } from "@tanstack/react-query";
import { fetchAPI } from "@/features/api/fetchApi";

export function useShowSignaturesApi(pdfId: string | null | undefined) {
  return useQuery({
    queryKey: ['signature-information', pdfId],
    queryFn: async () => {
      const response = await fetchAPI(`signatures/${pdfId}/`);
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
      
      return response.json();
    },
    // To avoid useless requests :
    enabled: !!pdfId,  
    staleTime: 1000,
    // Number of retries before failing
    retry: 2,
  });
}

type Props = {
  item: Item;
  isOpen: boolean;
  onClose: () => void;
};

export const SignatureInformationModal = ({
    item,
    isOpen,
    onClose,
}: Props) => {
    const { t } = useTranslation();

    const { data } = useShowSignaturesApi(item.id);

    type Signature = {
        prenom: string;
        nom: string;
        email: string;
        is_signed: boolean;
        signature_date: string | null;
        eIDAS_lvl_1: boolean | null;
        eIDAS_lvl_2: boolean | null;
    };

    // Colonnes minimales
    const columns = [
        { field: 'prenom', headerName: 'Prénom' },
        { field: 'nom', headerName: 'Nom' },
        { field: 'is_signed', headerName: 'Signé' },
        { field: 'signature_date', headerName: 'Date' },
        { field: 'eIDAS_lvl_1', headerName: 'Identifié(e)' },
        { field: 'eIDAS_lvl_2', headerName: 'Authentifié(e)' },
    ];

    // Rows avec id obligatoire
    const rows = data?.map((sig: Signature, index: number) => ({
        id: index,
        prenom: sig.prenom,
        nom: sig.nom,
        // signature_signed: sig.signature_signed,
        
        is_signed: sig.is_signed
        ? <div className="clr-content-semantic-brand-primary"><CircleCheck /></div>
        : <div className="clr-brand-350"><Circle /></div>,

        ...(sig.is_signed && {
            signature_date: sig.signature_date,
            eIDAS_lvl_1: sig.eIDAS_lvl_1
            ? <div className="clr-content-semantic-brand-primary"><CircleCheck /></div>
            : <div className="clr-brand-350"><Circle /></div>,
            eIDAS_lvl_2: sig.eIDAS_lvl_2
            ? <div className="clr-content-semantic-brand-primary"><CircleCheck /></div>
            : <div className="clr-brand-350"><Circle /></div>,
        }),

    })) ?? [];
    
    return (
      <Modal
          isOpen={isOpen}
          onClose={onClose}
          title="Signatures du document"
          size={ModalSize.MEDIUM}
          rightActions={
              <Button variant="bordered" onClick={onClose}>
                  Fermer
              </Button>
          }
      >
          <div className="c__modal__content__text">
              <DataGrid
                columns={columns}
                rows={rows}
              />
            
          </div>
      </Modal>
    );
};