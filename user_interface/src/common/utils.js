export const getHeightAndWidthFromDataUrl = dataURL => new Promise(resolve => {
  const img = new Image()
  img.onload = () => {
    resolve({
      height: img.height,
      width: img.width
    })
  }
  img.src = dataURL
})