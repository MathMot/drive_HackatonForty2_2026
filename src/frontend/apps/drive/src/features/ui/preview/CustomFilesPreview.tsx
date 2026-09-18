import { Item, ItemType } from "@/features/drivers/types";
import {
  FilePreview,
  FilePreviewType,
  Button,
  useModal,
} from "@gouvfr-lasuite/ui-components";
import { useTranslation } from "react-i18next";
import { PropsWithChildren, useEffect, useMemo, useState } from "react";
import posthog from "posthog-js";
import { isPdfItem, itemToPreviewFile } from "@/features/explorer/utils/utils";
import { useDownloadItem } from "@/features/items/hooks/useDownloadItem";
import { ItemInfo } from "@/features/items/components/ItemInfo";
import { ItemShareModal } from "@/features/explorer/components/modals/share/ItemShareModal";
import { ItemSignModal } from "@/features/explorer/components/modals/sign/ItemSignModal";
import { openWopiInNewTab } from "@/features/wopi/openWopi";
import { useAuth } from "@/features/auth/Auth";
import { AnonymousCTA } from "../components/anonymous-cta/AnonymousCTA";
import { MyFilesCTA } from "../components/my-files-cta/MyFilesCTA";
import {
  CUSTOM_SIGNATURE_SRC,
  SignType,
  SignZone,
  SignZoneOverlayManager,
} from "@/features/explorer/components/modals/sign/SignZoneOverlayManager";
import {
  useMutationSelfSign,
  useMutationExecuteSign,
} from "@/features/explorer/hooks/useMutationsAccesses";
import {
  addToast,
  ToasterItem,
} from "@/features/ui/components/toaster/Toaster";
import { useRouter } from "next/router";

export enum CustomFilesPreviewMode {
  // The actions header will be the default actions header.
  DEFAULT = "default",
  // The actions header will be contextual to the authentication status of the user.
  CONTEXTUAL = "contextual",
}

export type SignMode = "selfsign" | "sign";

type CustomFilesPreviewProps = {
  currentItem?: Item;
  items: Item[];
  setPreviewItem?: (item?: Item) => void;
  onClose?: () => void;
  mode?: CustomFilesPreviewMode;
  isSignMode?: boolean;
  signMode?: SignMode;
};

export const CustomFilesPreview = ({
  currentItem,
  items,
  setPreviewItem,
  onClose,
  mode = CustomFilesPreviewMode.DEFAULT,
  isSignMode = false,
  signMode,
}: CustomFilesPreviewProps) => {
  const { handleDownloadItem } = useDownloadItem();
  const { user } = useAuth();
  const router = useRouter();
  const [signZone, setSignZone] = useState<SignZone | null>(null);

  // Always reset zone placement when switching documents or modes
  useEffect(() => {
    setSignZone(null);
  }, [currentItem?.id, signMode]);

  const files = useMemo(() => {
    return items
      .filter((item) => item.type === ItemType.FILE)
      .map(itemToPreviewFile);
  }, [items]);

  const handleClosePreview = () => {
    if (onClose) {
      onClose();
    } else if (setPreviewItem) {
      setPreviewItem(undefined);
    } else {
      if (window.history.length > 1) {
        router.back();
      } else if ((currentItem as any)?.parentId) {
        router.push(`/explorer/items/${(currentItem as any).parentId}`);
      } else {
        router.push("/explorer/items/my-files");
      }
    }
  };

  const handleChangePreviewItem = (file?: FilePreviewType) => {
    const item = items.find((item) => file?.id === item.id);
    setPreviewItem?.(item);
  };

  const effectiveSignMode: SignMode | undefined =
    signMode || (isSignMode ? "selfsign" : undefined);

  const effectiveIsSignMode = isSignMode || !!effectiveSignMode;

  // If item has an attached sign_request, compute fixedZone
  const fixedZone: SignZone | null = useMemo(() => {
    if (!currentItem?.sign_request) return null;
    return {
      pageIndex: currentItem.sign_request.zone_page,
      xPct: currentItem.sign_request.zone_x,
      yPct: currentItem.sign_request.zone_y,
      widthPct: currentItem.sign_request.zone_width,
      heightPct: currentItem.sign_request.zone_height,
    };
  }, [currentItem?.sign_request]);

  const signerDisplayName = useMemo(() => {
    if (effectiveSignMode === "selfsign") {
      return (user as any)?.full_name || user?.email || "";
    }
    if (effectiveSignMode === "sign") {
      return (user as any)?.full_name || currentItem?.sign_request?.signer_name || user?.email || "";
    }
    return "";

  }, [effectiveSignMode, user, currentItem?.sign_request]);

  const isLockedFile = !!effectiveIsSignMode;

  return (
    <>
      <FilePreview
        isOpen={!!currentItem}
        onClose={handleClosePreview}
        files={files}
        onChangeFile={handleChangePreviewItem}
        handleDownloadFile={() => handleDownloadItem(currentItem)}
        openedFileId={currentItem?.id}
        onFileOpen={(file) =>
          posthog.capture("file_preview_opened", {
            id: file.id,
            size: file.size,
            mimetype: file.mimetype,
          })
        }
        onOpenInEditor={isLockedFile ? undefined : openWopiInNewTab}
        customHeaderActions={(actions) => (
          <CustomFilesPreviewRightHeader
            currentItem={currentItem}
            mode={mode}
            isSignMode={effectiveIsSignMode}
            signMode={effectiveSignMode}
            signZone={signZone}
          >
            {actions}
          </CustomFilesPreviewRightHeader>
        )}
        sidebarContent={currentItem && <ItemInfo item={currentItem} />}
      />
      <SignZoneOverlayManager
        isSignMode={effectiveIsSignMode}
        signMode={effectiveSignMode}
        currentItemId={currentItem?.id}
        fixedZone={fixedZone}
        signerDisplayName={signerDisplayName}
        onZoneChange={setSignZone}
      />
    </>
  );
};

type CustomFilesPreviewRightHeaderProps = {
  currentItem?: Item;
  mode: CustomFilesPreviewMode;
  isSignMode?: boolean;
  signMode?: SignMode;
  signZone?: SignZone | null;
  children: React.ReactNode;
};

const CustomFilesPreviewRightHeader = ({
  children,
  currentItem,
  mode,
  isSignMode,
  signMode,
  signZone,
}: CustomFilesPreviewRightHeaderProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const shareModal = useModal();
  const signModal = useModal();
  const { mutateAsync: selfSign } = useMutationSelfSign();
  const { mutateAsync: executeSign } = useMutationExecuteSign();
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!currentItem) {
    return null;
  }

  const handleSelfSign = async () => {
    if (!signZone) return;
    setIsSubmitting(true);
    try {
      const zonePayload = {
        ...signZone,
        ...(signZone.signType === SignType.CustomSignature && !signZone.imageUrl
          ? { imageUrl: CUSTOM_SIGNATURE_SRC }
          : {}),
      };
      await selfSign({
        itemId: currentItem.id,
        zone: zonePayload,
        suffix: t("sign_modal.sign_file_suffix", "signé"),
      });
      if ((currentItem as any).parentId) {
        router.push(`/explorer/items/${(currentItem as any).parentId}`);
      } else {
        router.push("/explorer/items/my-files");
      }
    } catch (err) {
      console.error("Failed to self-sign document", err);
      addToast(
        <ToasterItem type="error">
          <span>{t("sign_viewer.error_create", "Une erreur est survenue lors de la signature du document.")}</span>
        </ToasterItem>,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteSign = async () => {
    if (!signZone) return;
    setIsSubmitting(true);
    try {
      const zonePayload = {
        ...signZone,
        ...(signZone.signType === SignType.CustomSignature && !signZone.imageUrl
          ? { imageUrl: CUSTOM_SIGNATURE_SRC }
          : {}),
      };
      await executeSign({
        itemId: currentItem.id,
        zone: zonePayload,
      });
      router.push("/explorer/items/shared-with-me");
    } catch (err) {
      console.error("Failed to sign document", err);
      addToast(
        <ToasterItem type="error">
          <span>{t("sign_viewer.error_create", "Une erreur est survenue lors de la signature.")}</span>
        </ToasterItem>,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      {/* Self sign mode */}
      {isSignMode && signMode === "selfsign" && (
        <Button
          color="brand"
          icon={<span className="material-icons">draw</span>}
          disabled={!signZone || isSubmitting}
          onClick={handleSelfSign}
        >
          {signZone
            ? t("sign_viewer.self_sign_btn", "Signer le document")
            : t("sign_viewer.place_zone", "Cliquez sur le document pour placer le tampon")}
        </Button>
      )}

      {/* Recipient signing mode */}
      {isSignMode && signMode === "sign" && (
        <Button
          color="brand"
          icon={<span className="material-icons">check</span>}
          disabled={!signZone || isSubmitting}
          onClick={handleExecuteSign}
        >
          {signZone
            ? t("sign_viewer.recipient_sign_btn", "Signer le document")
            : t("sign_viewer.place_zone", "Cliquez sur le document pour placer le tampon")}
        </Button>
      )}

      {/* Default share button (when not in sign mode) */}
      {!isSignMode && mode === CustomFilesPreviewMode.DEFAULT && (
        <>
          <div className="custom-files-preview-right-header">
            <Button variant="tertiary" onClick={shareModal.open}>
              {t("explorer.rightPanel.share")}
            </Button>
          </div>

          {shareModal.isOpen && (
            <ItemShareModal {...shareModal} item={currentItem} />
          )}
        </>
      )}

      {/* Sign button when viewing PDF file */}
      {!isSignMode && isPdfItem(currentItem) && (
        <>
          <div className="custom-files-preview-right-header">
            <Button
              variant="tertiary"
              icon={<span className="material-icons">draw</span>}
              onClick={signModal.open}
            >
              {t("explorer.item.actions.sign", "Signer")}
            </Button>
          </div>

          {signModal.isOpen && (
            <ItemSignModal {...signModal} item={currentItem} />
          )}
        </>
      )}

      {children}

      {mode === CustomFilesPreviewMode.CONTEXTUAL && (
        <div className="custom-files-preview-right-header">
          {user ? <MyFilesCTA /> : <AnonymousCTA />}
        </div>
      )}
    </div>
  );
};
