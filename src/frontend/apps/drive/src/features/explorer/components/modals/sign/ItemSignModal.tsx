import {
  Button,
  Modal,
  ModalSize,
  removeFileExtension,
  UserRow,
} from "@gouvfr-lasuite/ui-components";
import { useRouter } from "next/router";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Item, User } from "@/features/drivers/types";
import { useAuth } from "@/features/auth/Auth";
import { useUsers } from "@/features/users/hooks/useUserQueries";
import { useMutationRequestSign } from "@/features/explorer/hooks/useMutationsAccesses";
import {
  addToast,
  ToasterItem,
} from "@/features/ui/components/toaster/Toaster";

export interface ItemSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item;
}

export const ItemSignModal = ({ isOpen, onClose, item }: ItemSignModalProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { mutateAsync: requestSign, isPending: isSubmitting } = useMutationRequestSign();

  const [signers, setSigners] = useState<User[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [queryValue, setQueryValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const onSearch = (search: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (search.trim() === "") {
      setQueryValue("");
      return;
    }

    timeoutRef.current = setTimeout(() => {
      setQueryValue(search.trim());
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Search registered users with debounce
  const { data: searchResults, isLoading: isSearching } = useUsers(
    { q: queryValue },
    {
      enabled: queryValue !== undefined && queryValue !== "",
      placeholderData: (prev: User[] | undefined) => prev,
    },
  );

  const filteredSuggestions = useMemo(() => {
    if (!searchResults) return [];
    return searchResults.filter(
      (u: User) =>
        !signers.some(
          (s) => s.id === u.id || s.email.toLowerCase() === u.email.toLowerCase(),
        ) &&
        u.email.toLowerCase() !== currentUser?.email?.toLowerCase(),
    );
  }, [searchResults, signers, currentUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const addSigner = (user: User) => {
    if (
      !signers.some(
        (s) => s.id === user.id || s.email.toLowerCase() === user.email.toLowerCase(),
      )
    ) {
      setSigners((prev) => [...prev, user]);
    }
    setInputValue("");
    setQueryValue("");
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowSuggestions(false);
  };

  const removeSigner = (userId: string) => {
    setSigners((prev) => prev.filter((s) => s.id !== userId));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setShowSuggestions(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
    }
  };

  const handleSignMyself = () => {
    onClose();
    router.push(`/explorer/items/files/${item.id}?mode=selfsign`);
  };

  const handleSendRequests = async () => {
    if (signers.length === 0) return;
    try {
      await requestSign({
        itemId: item.id,
        signers: signers.map((s) => s.email),
        suffix: t("sign_modal.sign_file_suffix", "signé"),
      });
      onClose();
    } catch (err) {
      console.error("Failed to request signatures", err);
      addToast(
        <ToasterItem type="error">
          <span>{t("sign_viewer.error_create", "Une erreur est survenue lors de l'envoi de la demande de signature.")}</span>
        </ToasterItem>,
      );
    }
  };

  const fileName = removeFileExtension(item.title);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size={ModalSize.MEDIUM}
      title={t("sign_modal.title", { title: fileName, defaultValue: `Faire signer : ${fileName}` })}
      aria-label="Sign modal"
      rightActions={
        <>
          <Button variant="bordered" disabled={isSubmitting} onClick={onClose}>
            {t("sign_modal.cancel", "Annuler")}
          </Button>
          <Button
            color="brand"
            disabled={signers.length === 0 || isSubmitting}
            onClick={handleSendRequests}
          >
            {t("sign_modal.send_request", "Envoyer la demande")}
          </Button>
        </>
      }
    >
      <div className="sign-modal-content">
        {/* Section 1: Sign myself */}
        <div className="sign-modal-section sign-modal-section--self">
          <div className="sign-modal-section__header">
            <span className="sign-modal-section__title">
              {t("sign_modal.self_section_title", "Vous devez signer ce document vous-même ?")}
            </span>
          </div>
          <Button
            variant="secondary"
            color="brand"
            onClick={handleSignMyself}
            icon={<span className="material-icons">draw</span>}
          >
            {t("sign_modal.self_button", "Signer le document moi-même")}
          </Button>
        </div>

        {/* Divider */}
        <div className="sign-modal-divider">
          <span>{t("sign_modal.or", "ou faire signer par d'autres personnes")}</span>
        </div>

        {/* Section 2: Request signatures from others */}
        <div className="sign-modal-section">
          <div className="sign-modal-section__header">
            <span className="sign-modal-section__title">
              {t("sign_modal.request_section_title", "Inviter des personnes à signer ce document")}
            </span>
            <p className="sign-modal-section__desc">
              {t(
                "sign_modal.request_section_desc",
                "Recherchez par nom ou par adresse e-mail les personnes qui doivent signer :",
              )}
            </p>
          </div>

          {/* Search bar matching share modal */}
          <div className="sign-modal-input-row">
            <div className="sign-modal-input-wrapper" ref={searchContainerRef}>
              {isSearching ? (
                <span className="material-icons sign-modal-search-spinner">sync</span>
              ) : (
                <span className="material-icons sign-modal-search-icon">search</span>
              )}
              <input
                type="text"
                className="sign-modal-input"
                placeholder={t(
                  "sign_modal.input_placeholder",
                  "Rechercher un nom ou une adresse e-mail",
                )}
                value={inputValue}
                onChange={(e) => {
                  const val = e.target.value;
                  setInputValue(val);
                  onSearch(val);
                  setShowSuggestions(true);
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (inputValue.trim()) {
                    setShowSuggestions(true);
                  }
                }}
              />
              {inputValue && (
                <button
                  type="button"
                  className="sign-modal-clear-btn"
                  onClick={() => {
                    setInputValue("");
                    setQueryValue("");
                    if (timeoutRef.current) clearTimeout(timeoutRef.current);
                    setShowSuggestions(false);
                  }}
                  title={t("sign_modal.clear_search", "Effacer")}
                  aria-label={t("sign_modal.clear_search", "Effacer")}
                >
                  <span className="material-icons">close</span>
                </button>
              )}

              {/* Autocomplete suggestions dropdown */}
              {showSuggestions && inputValue.trim().length > 0 && (
                <div className="sign-modal-suggestions">
                  {isSearching && (
                    <div className="sign-modal-suggestions__item sign-modal-suggestions__item--loading">
                      <span className="material-icons sign-modal-suggestions__spinner">sync</span>
                      <span>{t("sign_modal.searching", "Recherche en cours...")}</span>
                    </div>
                  )}
                  {!isSearching && filteredSuggestions.length === 0 && (
                    <div className="sign-modal-suggestions__item sign-modal-suggestions__item--empty">
                      <span className="material-icons">info</span>
                      <span>{t("sign_modal.no_results", "Aucun utilisateur trouvé")}</span>
                    </div>
                  )}
                  {filteredSuggestions.map((user: User) => (
                    <div
                      key={user.id}
                      role="button"
                      tabIndex={0}
                      className="sign-modal-suggestions__item"
                      onClick={() => addSigner(user)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          addSigner(user);
                        }
                      }}
                    >
                      <UserRow fullName={user.full_name} email={user.email} />
                      <span className="sign-modal-suggestions__add-icon material-icons">add</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Added Signers List */}
          <div className="sign-modal-signers">
            <div className="sign-modal-signers__title">
              {t("sign_modal.signers_title", {
                count: signers.length,
                defaultValue: `Signataires à inviter (${signers.length})`,
              })}
            </div>

            {signers.length === 0 ? (
              <div className="sign-modal-signers__empty">
                <span className="material-icons">group_add</span>
                <p>
                  {t(
                    "sign_modal.no_signers",
                    "Aucun signataire ajouté. Recherchez un utilisateur ci-dessus pour l'ajouter.",
                  )}
                </p>
              </div>
            ) : (
              <div className="sign-modal-signers__list">
                {signers.map((signer) => (
                  <div key={signer.id} className="sign-modal-signer-item">
                    <div className="sign-modal-signer-item__info">
                      <UserRow fullName={signer.full_name} email={signer.email} />
                    </div>
                    <div className="sign-modal-signer-item__actions">
                      <span className="sign-modal-role-badge">
                        {t("sign_modal.role_signer", "Signataire")}
                      </span>
                      <button
                        type="button"
                        className="sign-modal-remove-btn"
                        onClick={() => removeSigner(signer.id)}
                        title={t("sign_modal.remove_signer", "Supprimer")}
                        aria-label={t("sign_modal.remove_signer", "Supprimer")}
                      >
                        <span className="material-icons">close</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};