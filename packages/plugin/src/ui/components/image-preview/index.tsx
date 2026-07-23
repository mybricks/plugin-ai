import React, { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import classNames from "classnames";
import { Close } from "../icons";
import css from "./index.less";

interface ImagePreviewGroupProps {
  images: string[];
  visible: boolean;
  current?: number;
  onVisibleChange?: (visible: boolean) => void;
  onCurrentChange?: (current: number) => void;
}

const ChevronLeft = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M15.5 4.5 8 12l7.5 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronRight = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="m8.5 4.5 7.5 7.5-7.5 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ImagePreviewGroup = ({
  images,
  visible,
  current = 0,
  onVisibleChange,
  onCurrentChange,
}: ImagePreviewGroupProps) => {
  const normalizedImages = useMemo(() => images.filter(Boolean), [images]);
  const imageCount = normalizedImages.length;
  const currentIndex = imageCount ? Math.min(Math.max(current, 0), imageCount - 1) : 0;
  const currentSrc = normalizedImages[currentIndex];

  const close = () => onVisibleChange?.(false);
  const updateCurrent = (next: number) => {
    if (!imageCount) return;
    onCurrentChange?.((next + imageCount) % imageCount);
  };

  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }

      if (event.key === "ArrowLeft") {
        updateCurrent(currentIndex - 1);
        return;
      }

      if (event.key === "ArrowRight") {
        updateCurrent(currentIndex + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, currentIndex, imageCount]);

  useEffect(() => {
    if (!visible || typeof document === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  if (!visible || !currentSrc || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className={css.previewRoot} role="dialog" aria-modal="true" onClick={close}>
      <button className={classNames(css.actionButton, css.closeButton)} type="button" onClick={close} aria-label="关闭图片预览">
        <Close />
      </button>
      {imageCount > 1 && (
        <>
          <button
            className={classNames(css.actionButton, css.prevButton)}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              updateCurrent(currentIndex - 1);
            }}
            aria-label="上一张图片"
          >
            <ChevronLeft />
          </button>
          <button
            className={classNames(css.actionButton, css.nextButton)}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              updateCurrent(currentIndex + 1);
            }}
            aria-label="下一张图片"
          >
            <ChevronRight />
          </button>
        </>
      )}
      <div className={css.imageStage} onClick={(event) => event.stopPropagation()}>
        <img className={css.previewImage} src={currentSrc} />
      </div>
      {imageCount > 1 && (
        <div className={css.counter}>
          {currentIndex + 1} / {imageCount}
        </div>
      )}
    </div>,
    document.body
  );
};

export { ImagePreviewGroup };
