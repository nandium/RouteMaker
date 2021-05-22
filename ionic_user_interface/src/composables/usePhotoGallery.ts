import { Ref, ref } from 'vue';
import {
  Plugins,
  CameraResultType,
  CameraSource,
  CameraPhoto,
  Capacitor,
  FilesystemDirectory,
} from '@capacitor/core';
import { isPlatform } from '@ionic/vue';
import imageCompression from 'browser-image-compression';

export function usePhotoGallery(): {
  photo: Ref<Photo | null>;
  takePhoto: () => void;
} {
  const { Camera, Filesystem } = Plugins;
  const photo = ref<Photo | null>(null);

  const convertBlobToFile = (theBlob: Blob, fileName: string): File => {
    const b: any = theBlob;
    b.lastModifiedDate = new Date();
    b.name = fileName;

    return <File>theBlob;
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

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
        const response = await fetch(photo.webPath);
        const compressImageOptions = {
          maxSizeMB: 6,
          maxWidthOrHeight: 1024,
          useWebWorker: true,
          fileType: 'image/jpeg',
        };
        const imageFile = await imageCompression(
          convertBlobToFile(await response.blob(), 'photo.jpg'),
          compressImageOptions,
        );
        base64Data = await convertFileToBase64(imageFile);
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
        data: Capacitor.convertFileSrc(savedFile.uri),
      };
    } else {
      // Use webPath to display the new image instead of base64 since it's
      // already loaded into memory
      return {
        filepath: fileName,
        data: base64Data,
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
}
