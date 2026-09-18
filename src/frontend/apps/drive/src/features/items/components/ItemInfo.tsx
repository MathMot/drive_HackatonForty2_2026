import { useState } from "react";
import { Item } from "@/features/drivers/types";
import { formatSize } from "@/features/explorer/utils/utils";
import { InfoRow } from "@/features/ui/components/info/InfoRow";
import { Book } from "@gouvfr-lasuite/ui-components/icons";
import { Button, UserRow } from "@gouvfr-lasuite/ui-components";
import { useTranslation } from "react-i18next";
import { getFormatTranslationKey } from "@/features/explorer/utils/mimeTypes";
import { SignatureInformationModal } from "../../explorer/components/modals/SignatureInformationModal"; 

export type ItemInfoProps = {
  item: Item;
};

export const ItemInfo = ({ item }: ItemInfoProps) => {
  const { t } = useTranslation();
const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="item-info">
      <InfoRow
        label={t("explorer.rightPanel.format")}
        rightContent={t(getFormatTranslationKey(item))}
      />
      <InfoRow
        label={t("explorer.rightPanel.updated_at")}
        rightContent={item.updated_at.toLocaleString(undefined, {
          dateStyle: "short",
          timeStyle: "short",
        })}
      />
      <InfoRow
        label={t("explorer.rightPanel.created_at")}
        rightContent={
          item.created_at
            ? new Date(item?.created_at).toLocaleString(undefined, {
                dateStyle: "short",
                timeStyle: "short",
              })
            : ""
        }
      />
      {item.size && (
        <InfoRow
          label={t("explorer.rightPanel.size")}
          rightContent={formatSize(item.size, t)}
        />
      )}
      <InfoRow
        label={t("explorer.rightPanel.created_by")}
        rightContent={<UserRow fullName={item.creator.full_name} />}
      />
      {!item.is_signed && (
          <InfoRow
            label={t("explorer.rightPanel.is_signed")}
            rightContent={
              <Button
              icon={<Book />}
              variant="tertiary"
              onClick={() => setIsModalOpen(true)}
              />
            }
          />
      )}
      <SignatureInformationModal
        item={item}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};