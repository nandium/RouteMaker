/**
 * @param dataURL base64string of an Image
 * @returns width, height
 */
export const getHeightAndWidthFromDataUrl = (
  dataURL: string,
): Promise<{ height: number; width: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        height: img.height,
        width: img.width,
      });
    };
    img.src = dataURL;
  });
};
