import { ref } from 'vue';
import {
  Plugins,
  CameraResultType,
  CameraSource,
  CameraPhoto,
  Capacitor,
  FilesystemDirectory,
} from '@capacitor/core';
import { isPlatform } from '@ionic/vue';

export function usePhotoGallery() {
  const { Camera, Filesystem } = Plugins;
  const photo = ref<Photo | null>(null);

  const convertBlobToBase64 = (blob: Blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.readAsDataURL(blob);
    });

  const savePicture = async (photo: CameraPhoto, fileName: string): Promise<Photo> => {
    let base64Data = '';
    // "hybrid" will detect Cordova or Capacitor;
    if (isPlatform('hybrid')) {
      if (photo.path) {
        const file = await Filesystem.readFile({
          path: photo.path,
        });
        base64Data = file.data;
      }
    } else {
      if (photo.webPath) {
        // Fetch the photo, read as a blob, then convert to base64 format
        const response = await fetch(photo.webPath);
        const blob = await response.blob();
        base64Data = (await convertBlobToBase64(blob)) as string;
      }
    }
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: FilesystemDirectory.Data,
    });

    if (isPlatform('hybrid')) {
      // Display the new image by rewriting the 'file://' path to HTTP
      // Details: https://ionicframework.com/docs/building/webview#file-protocol
      return {
        filepath: savedFile.uri,
        data: base64Data,
        webviewPath: Capacitor.convertFileSrc(savedFile.uri),
      };
    } else {
      // Use webPath to display the new image instead of base64 since it's
      // already loaded into memory
      return {
        filepath: fileName,
        data: base64Data,
        webviewPath: photo.webPath,
      };
    }
  };

  const takePhoto = async () => {
    const cameraPhoto = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
      quality: 100,
    });
    const fileName = new Date().getTime() + '.jpeg';
    const savedFileImage = await savePicture(cameraPhoto, fileName);

    photo.value = savedFileImage;
  };

  return {
    photo,
    takePhoto,
  };
}

export interface Photo {
  filepath: string;
  data?: string;
  webviewPath?: string;
}
