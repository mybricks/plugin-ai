

const getUniqueIdentifier = (focus: AiServiceFocusParams) => {
  if (!focus) return;
  const { comId, pageId, focusArea } = focus;
  if (focusArea) {
    return focusArea.ele
  }

  return `${pageId}-${comId}`
}

export { getUniqueIdentifier }