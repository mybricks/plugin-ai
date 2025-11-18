export function getFiles(files: RxFiles, {
  extName
}: {
  extName?: string
}) : RxFile | undefined {
  let result : RxFile | undefined
  Object.keys(files).forEach((fileName) => {
    const file = files[fileName] as RxFile;
    if (file.extension === extName) {
      result = file
    }
  })
  return result
}