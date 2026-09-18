import { Filter, FilterOption } from "@gouvfr-lasuite/ui-components";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

/**
 * =============================================================================
 * DEVELOPER FONT CONFIGURATION FOR SIGN BOX
 * =============================================================================
 * Fonts provided by @gouvfr-lasuite/ui-components:
 * - Option 1: 'Marianne' (official French administration typography)
 * - Option 2: 'Roboto Flex' (flexible, modern sans-serif typography)
 *
 * To toggle between them, comment/uncomment the desired SIGN_BOX_FONT line below:
 */
// Option 1: Marianne (default @gouvfr-lasuite/ui-components font)
// export const SIGN_BOX_FONT = "'Marianne', sans-serif";

// Option 2: Roboto Flex (uncomment to activate, and comment Option 1 above)
export const SIGN_BOX_FONT = "'Roboto Flex Variable', 'Roboto Flex', Roboto, sans-serif";

/**
 * Link to the custom signature image or SVG.
 * Can be a remote URL, local asset path (e.g. '/signature.svg'), or data URI.
 */
export const CUSTOM_SIGNATURE_SRC =
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQdJikztC8D_D_8TvYCYTN2jmsYWZaE7WkooIV7UXwbng&s=10";

// Store coordinates as percentages so they scale when the PDF zooms
export enum SignType {
  NoStamp = 0,
  FullName = 1,
  Initials = 2,
  Mister = 3,
  Missus = 4,
  Doctor = 5,
  CustomSignature = 6,
}

export interface SignZone {
  pageIndex: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
  signType?: SignType;
  imageUrl?: string;
}

const getLastName = (displayName: string) => {
  const trimmed = displayName.trim();
  if (!trimmed) return "";

  // If email fallback, extract part after dot or username
  if (trimmed.includes("@")) {
    const userPart = trimmed.split("@")[0];
    const dotParts = userPart.split(".");
    if (dotParts.length > 1) {
      const last = dotParts[dotParts.length - 1];
      return last.charAt(0).toUpperCase() + last.slice(1);
    }
    return userPart.charAt(0).toUpperCase() + userPart.slice(1);
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length > 1) {
    return parts[parts.length - 1];
  }
  return parts[0];
};

const getSignerText = (
  displayName: string,
  signType: SignType,
  t: (key: string, options?: any) => string,
) => {
  const baseName = displayName || t("sign_zone.default_signer", "Signataire");
  const lastName = getLastName(baseName);

  switch (signType) {
    case SignType.NoStamp:
    case SignType.CustomSignature:
      return "";
    case SignType.Initials: {
      const parts = baseName.trim().split(/\s+/);
      return parts
        .map((p) => (p[0] ? `${p[0].toUpperCase()}.` : ""))
        .join(" ");
    }
    case SignType.Mister:
      return t("sign_zone.title_mister", {
        name: lastName,
        defaultValue: `M. ${lastName}`,
      });
    case SignType.Missus:
      return t("sign_zone.title_missus", {
        name: lastName,
        defaultValue: `Mme ${lastName}`,
      });
    case SignType.Doctor:
      return t("sign_zone.title_doctor", {
        name: lastName,
        defaultValue: `Dr ${lastName}`,
      });
    case SignType.FullName:
    default:
      return baseName;
  }
};

const RESIZE_HANDLE_SIZE = 24;

const resizeHandleStyle: React.CSSProperties = {
  position: "absolute",
  bottom: -RESIZE_HANDLE_SIZE / 2,
  right: -RESIZE_HANDLE_SIZE / 2,
  width: RESIZE_HANDLE_SIZE,
  height: RESIZE_HANDLE_SIZE,
  background: "#000091",
  border: "2px solid #ffffff",
  cursor: "nwse-resize",
  borderRadius: "25%",
  boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
  zIndex: 2,
};

const MIN_WIDTH_PCT = 15;
const MAX_WIDTH_PCT = 60;
const MIN_HEIGHT_PCT = 6;
const MAX_HEIGHT_PCT = 30;
const DEFAULT_WIDTH_PCT = 25;
const DEFAULT_HEIGHT_PCT = 9;

export interface SignZoneOverlayManagerProps {
  isSignMode: boolean;
  signMode?: "selfsign" | "sign";
  currentItemId?: string;
  fixedZone?: SignZone | null;
  signerDisplayName?: string;
  onZoneChange?: (zone: SignZone | null) => void;
}

export const SignZoneOverlayManager = ({
  isSignMode,
  signMode = "selfsign",
  currentItemId,
  fixedZone,
  signerDisplayName,
  onZoneChange,
}: SignZoneOverlayManagerProps) => {
  const { t } = useTranslation();

  const signTypeOptions: FilterOption[] = useMemo(
    () => [
      {
        value: String(SignType.CustomSignature),
        label: t("sign_zone.type.custom", "Signature personnalisée"),
        render: () => (
          <div className="explorer__filters__item">
            {t("sign_zone.type.custom", "Signature personnalisée")}
          </div>
        ),
      },
      {
        value: String(SignType.FullName),
        label: t("sign_zone.type.full_name", "Nom complet"),
        render: () => (
          <div className="explorer__filters__item">
            {t("sign_zone.type.full_name", "Nom complet")}
          </div>
        ),
      },
      {
        value: String(SignType.Initials),
        label: t("sign_zone.type.initials", "Initiales"),
        render: () => (
          <div className="explorer__filters__item">
            {t("sign_zone.type.initials", "Initiales")}
          </div>
        ),
      },
      {
        value: String(SignType.Mister),
        label: t("sign_zone.type.mister", "Monsieur"),
        render: () => (
          <div className="explorer__filters__item">
            {t("sign_zone.type.mister", "Monsieur")}
          </div>
        ),
      },
      {
        value: String(SignType.Missus),
        label: t("sign_zone.type.missus", "Madame"),
        render: () => (
          <div className="explorer__filters__item">
            {t("sign_zone.type.missus", "Madame")}
          </div>
        ),
      },
      {
        value: String(SignType.Doctor),
        label: t("sign_zone.type.doctor", "Docteur"),
        render: () => (
          <div className="explorer__filters__item">
            {t("sign_zone.type.doctor", "Docteur")}
          </div>
        ),
      },
      {
        value: String(SignType.NoStamp),
        label: t("sign_zone.type.no_stamp", "Signature électronique seule"),
        render: () => (
          <div className="explorer__filters__item">
            {t("sign_zone.type.no_stamp", "Signature électronique seule")}
          </div>
        ),
      },
    ],
    [t],
  );
  const [pages, setPages] = useState<HTMLElement[]>([]);
  const [currentZone, setCurrentZone] = useState<SignZone | null>(
    fixedZone || null,
  );

  const isInteractive = true;

  // Reset or update zone whenever itemId, signMode, or fixedZone changes
  useEffect(() => {
    setCurrentZone(fixedZone || null);
  }, [currentItemId, signMode, fixedZone]);

  const dragRef = useRef<{
    type: "move" | "resize";
    startX: number;
    startY: number;
    startZone: SignZone;
    pageRect: DOMRect;
  } | null>(null);

  const isDraggingOrResizingRef = useRef(false);
  const wasDraggingRef = useRef(false);
  const dragCleanupTimerRef = useRef<NodeJS.Timeout | null>(null);

  const stableOnZoneChange = useRef(onZoneChange);
  stableOnZoneChange.current = onZoneChange;

  useEffect(() => {
    stableOnZoneChange.current?.(currentZone);
  }, [currentZone]);

  useEffect(() => {
    if (!isSignMode) {
      setPages([]);
      return;
    }

    const findPages = () => {
      const pageElements = Array.from(
        document.querySelectorAll(".react-pdf__Page"),
      ) as HTMLElement[];

      setPages((prevPages) => {
        if (
          pageElements.length !== prevPages.length ||
          !pageElements.every((el, i) => el === prevPages[i])
        ) {
          pageElements.forEach((page) => {
            if (getComputedStyle(page).position === "static") {
              page.style.position = "relative";
            }
          });
          return pageElements;
        }
        return prevPages;
      });
    };

    findPages();

    let timeoutId: NodeJS.Timeout;
    const observer = new MutationObserver(() => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(findPages, 200);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [isSignMode]);

  // Click on a page to create or move the signature zone
  const handlePageClick = (
    e: React.MouseEvent<HTMLDivElement>,
    pageIndex: number,
    pageEl: HTMLElement,
  ) => {
    if (!isInteractive) return;
    if (dragRef.current || isDraggingOrResizingRef.current || wasDraggingRef.current) return;

    const rect = pageEl.getBoundingClientRect();
    const clickXPct = ((e.clientX - rect.left) / rect.width) * 100;
    const clickYPct = ((e.clientY - rect.top) / rect.height) * 100;

    const rawW = currentZone ? currentZone.widthPct : DEFAULT_WIDTH_PCT;
    const rawH = currentZone ? currentZone.heightPct : DEFAULT_HEIGHT_PCT;
    const w = Math.max(MIN_WIDTH_PCT, Math.min(MAX_WIDTH_PCT, rawW));
    const h = Math.max(MIN_HEIGHT_PCT, Math.min(MAX_HEIGHT_PCT, rawH));

    const xPct = Math.max(0, Math.min(clickXPct - w / 2, 100 - w));
    const yPct = Math.max(0, Math.min(clickYPct - h / 2, 100 - h));

    const chosenSignType = currentZone?.signType ?? SignType.FullName;
    setCurrentZone({
      pageIndex,
      xPct: Math.round(xPct * 100) / 100,
      yPct: Math.round(yPct * 100) / 100,
      widthPct: w,
      heightPct: h,
      signType: chosenSignType,
      imageUrl:
        chosenSignType === SignType.CustomSignature
          ? currentZone?.imageUrl || CUSTOM_SIGNATURE_SRC
          : undefined,
    });
  };

  // Drag-to-move handling
  const handleZoneMouseDown = (
    e: React.MouseEvent,
    pageEl: HTMLElement,
  ) => {
    if (!isInteractive) return;
    e.stopPropagation();
    if (!currentZone) return;

    if (dragCleanupTimerRef.current) {
      clearTimeout(dragCleanupTimerRef.current);
      dragCleanupTimerRef.current = null;
    }
    isDraggingOrResizingRef.current = true;
    wasDraggingRef.current = true;

    dragRef.current = {
      type: "move",
      startX: e.clientX,
      startY: e.clientY,
      startZone: { ...currentZone },
      pageRect: pageEl.getBoundingClientRect(),
    };
  };

  // Drag-to-resize handling
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, pageEl: HTMLElement) => {
      if (!isInteractive) return;
      e.stopPropagation();
      if (!currentZone) return;

      if (dragCleanupTimerRef.current) {
        clearTimeout(dragCleanupTimerRef.current);
        dragCleanupTimerRef.current = null;
      }
      isDraggingOrResizingRef.current = true;
      wasDraggingRef.current = true;

      dragRef.current = {
        type: "resize",
        startX: e.clientX,
        startY: e.clientY,
        startZone: { ...currentZone },
        pageRect: pageEl.getBoundingClientRect(),
      };
    },
    [currentZone, isInteractive],
  );

  // Global mouse move & mouse up listeners
  useEffect(() => {
    if (!isInteractive) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { type, startX, startY, startZone, pageRect } = dragRef.current;

      const deltaXPct = ((e.clientX - startX) / pageRect.width) * 100;
      const deltaYPct = ((e.clientY - startY) / pageRect.height) * 100;

      if (type === "move") {
        const maxX = 100 - startZone.widthPct;
        const maxY = 100 - startZone.heightPct;
        const newX = Math.max(0, Math.min(maxX, startZone.xPct + deltaXPct));
        const newY = Math.max(0, Math.min(maxY, startZone.yPct + deltaYPct));

        setCurrentZone((prev) =>
          prev
            ? {
                ...prev,
                xPct: Math.round(newX * 100) / 100,
                yPct: Math.round(newY * 100) / 100,
              }
            : null,
        );
      } else if (type === "resize") {
        const maxW = Math.min(MAX_WIDTH_PCT, 100 - startZone.xPct);
        const maxH = Math.min(MAX_HEIGHT_PCT, 100 - startZone.yPct);
        const newW = Math.max(
          MIN_WIDTH_PCT,
          Math.min(maxW, startZone.widthPct + deltaXPct),
        );
        const newH = Math.max(
          MIN_HEIGHT_PCT,
          Math.min(maxH, startZone.heightPct + deltaYPct),
        );

        setCurrentZone((prev) =>
          prev
            ? {
                ...prev,
                widthPct: Math.round(newW * 100) / 100,
                heightPct: Math.round(newH * 100) / 100,
              }
            : null,
        );
      }
    };

    const handleMouseUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        wasDraggingRef.current = true;
        if (dragCleanupTimerRef.current) {
          clearTimeout(dragCleanupTimerRef.current);
        }
        dragCleanupTimerRef.current = setTimeout(() => {
          isDraggingOrResizingRef.current = false;
          dragCleanupTimerRef.current = null;
        }, 300);
        setTimeout(() => {
          wasDraggingRef.current = false;
        }, 300);
      }
    };

    const handleClickCapture = (e: MouseEvent) => {
      if (wasDraggingRef.current || isDraggingOrResizingRef.current) {
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
        wasDraggingRef.current = false;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp, true);
    window.addEventListener("click", handleClickCapture, true);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp, true);
      window.removeEventListener("click", handleClickCapture, true);
      if (dragCleanupTimerRef.current) {
        clearTimeout(dragCleanupTimerRef.current);
      }
    };
  }, [isInteractive]);

  const { i18n } = useTranslation();
  const formattedDate = useMemo(() => {
    const now = new Date();
    const currentLang = i18n.language || "fr";
    const datePart = now.toLocaleDateString(currentLang, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return `${datePart}`;
  }, [i18n.language]);

  if (!isSignMode || pages.length === 0) {
    return null;
  }

  const pageOverlayStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    zIndex: 10,
    pointerEvents: isInteractive ? "auto" : "none",
    cursor: isInteractive ? "crosshair" : "default",
  };

  return (
    <>
      {pages.map((pageEl, index) =>
        createPortal(
          <div
            key={index}
            style={pageOverlayStyle}
            onClick={(e: React.MouseEvent<HTMLDivElement>) =>
              handlePageClick(e, index, pageEl)
            }
          >
            {currentZone && currentZone.pageIndex === index && (() => {
              const pageWidth = pageEl.clientWidth || 800;
              const pageHeight = pageEl.clientHeight || 1130;
              const zonePixelW = (currentZone.widthPct / 100) * pageWidth;
              const zonePixelH = (currentZone.heightPct / 100) * pageHeight;
              const scale = Math.max(
                0.4,
                Math.min(2.3, Math.min(zonePixelW / 215, zonePixelH / 107)),
              );
              const handleSize = Math.max(16, Math.min(32, Math.round(RESIZE_HANDLE_SIZE * scale)));

              return (
                <div
                  onMouseDown={(e) => handleZoneMouseDown(e, pageEl)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "absolute",
                    left: `${currentZone.xPct}%`,
                    top: `${currentZone.yPct}%`,
                    width: `${currentZone.widthPct}%`,
                    height: `${currentZone.heightPct}%`,
                    border: "1.5px solid rgba(0, 0, 145, 0.75)",
                    backgroundColor: "rgba(0, 0, 145, 0.04)",
                    cursor: isInteractive ? "grab" : "default",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    borderRadius: "1px",
                    userSelect: "none",
                    boxSizing: "border-box",
                    padding: "4px 8px",
                    paddingTop: `${Math.round(34 * scale)}px`,
                    pointerEvents: "auto",
                  }}
                >
                  {/* Transparent rubber stamp: name/date or custom signature image */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      height: "100%",
                      width: "100%",
                      textAlign: "center",
                      color: "#000091",
                      fontFamily: SIGN_BOX_FONT,
                    }}
                  >
                    {currentZone.signType === SignType.NoStamp ? (
                      <div
                        style={{
                          fontSize: `${scale}rem`,
                          fontStyle: "italic",
                          opacity: 0.6,
                        }}
                      >
                        {t("sign_zone.no_stamp", "Signature électronique seule")}
                      </div>
                    ) : currentZone.signType === SignType.CustomSignature ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                          alignItems: "center",
                          width: "100%",
                          height: "100%",
                          boxSizing: "border-box",
                          padding: "2px 4px",
                          overflow: "hidden",
                        }}
                      >
                        {/* Custom signature: loads image / SVG from a src link */}
                        <img
                          src={currentZone.imageUrl || CUSTOM_SIGNATURE_SRC}
                          alt={t("sign_zone.type.custom", "Signature personnalisée")}
                          style={{
                            maxWidth: "100%",
                            maxHeight: "75%",
                            objectFit: "contain",
                            userSelect: "none",
                            pointerEvents: "none",
                          }}
                        />
                        <div
                          style={{
                            fontSize: `${0.75 * scale}rem`,
                            opacity: 0.8,
                            marginTop: `${Math.round(2 * scale)}px`,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formattedDate}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          style={{
                            fontSize: `${scale}rem`,
                            fontWeight: "bold",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            width: "100%",
                          }}
                        >
                          {getSignerText(
                            signerDisplayName || "",
                            currentZone.signType ?? SignType.FullName,
                            t,
                          )}
                        </div>
                        <div
                          style={{
                            fontSize: `${scale}rem`,
                            opacity: 0.8,
                            marginTop: `${Math.round(1.5 * scale)}px`,
                          }}
                        >
                          {formattedDate}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Dropdown spanning full width at the top of the zone */}
                  <div
                    className="sign-zone__dropdown-container"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: `${100 / scale}%`,
                      zIndex: 10,
                      transform: `scale(${scale})`,
                      transformOrigin: "top left",
                      boxSizing: "border-box",
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Filter
                      label={t("sign_zone.type.label", "Type")}
                      options={signTypeOptions}
                      selectedKey={String(currentZone.signType ?? SignType.FullName)}
                      onSelectionChange={(key) => {
                        if (key !== null && key !== undefined) {
                          const selectedType = Number(key) as SignType;
                          setCurrentZone((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  signType: selectedType,
                                  imageUrl:
                                    selectedType === SignType.CustomSignature
                                      ? prev.imageUrl || CUSTOM_SIGNATURE_SRC
                                      : undefined,
                                }
                              : null,
                          );
                        }
                      }}
                      showReset={false}
                    />
                  </div>

                  {/* Resize handle (bottom-right corner) only in interactive mode */}
                  {isInteractive && (
                    <div
                      style={{
                        ...resizeHandleStyle,
                        width: handleSize,
                        height: handleSize,
                        bottom: -handleSize / 2,
                        right: -handleSize / 2,
                      }}
                      onMouseDown={(e) => handleResizeMouseDown(e, pageEl)}
                      onClick={(e) => e.stopPropagation()}
                      title={t("sign_zone.resize", "Redimensionner la zone")}
                    />
                  )}
                </div>
              );
            })()}
          </div>,
          pageEl,
        ),
      )}
    </>
  );
};
