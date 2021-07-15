import { Ref, ref } from 'vue';
import { CameraResultType, CameraSource, Photo, Camera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { isPlatform } from '@ionic/vue';
import imageCompression from 'browser-image-compression';

export function usePhotoGallery(): {
  photo: Ref<UserPhoto | null>;
  takePhoto: () => void;
} {
  const photo = ref<UserPhoto | null>(null);

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const savePicture = async (photo: Photo, fileName: string): Promise<UserPhoto> => {
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
          maxWidthOrHeight: 2048,
          useWebWorker: true,
          fileType: 'image/jpeg',
        };
        const imageFile = await imageCompression(
          new File([await response.blob()], 'photo.jpg', { type: 'image/jpeg' }),
          compressImageOptions,
        );
        base64Data = await convertFileToBase64(imageFile);
      }
    }

    if (isPlatform('hybrid')) {
      // Display the new image by rewriting the 'file://' path to HTTP
      // Details: https://ionicframework.com/docs/building/webview#file-protocol
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });
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
      source: CameraSource.Photos,
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

export interface UserPhoto {
  filepath: string;
  data?: string;
}
