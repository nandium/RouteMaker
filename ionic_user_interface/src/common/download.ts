import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share, ShareResult } from '@capacitor/share';
import { isPlatform } from '@ionic/core';

const downloadURI = async (uri: string, name: string): Promise<ShareResult | void> => {
  const blob = await (await fetch(uri)).blob();
  const file = new File([blob], name, { type: blob.type });
  // Some issues with typescript, requires this cast to the 'any' type
  const navigator: any = window.navigator;
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    return navigator.share({
      title: name,
      text: name,
      files: [file],
    } as ShareData);
  } else if (isPlatform('hybrid')) {
    const savedFile = await Filesystem.writeFile({
      path: name,
      data: uri,
      directory: Directory.Cache,
    });
    return Share.share({
      title: name,
      url: savedFile.uri,
    });
  } else {
    return new Promise<void>((resolve) => {
      const link = document.createElement('a');
      link.download = name;
      link.href = uri;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      resolve();
    });
  }
};

export { downloadURI };
