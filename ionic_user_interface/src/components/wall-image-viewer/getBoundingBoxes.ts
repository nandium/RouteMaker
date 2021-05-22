import axios from 'axios';
import { BoxClass } from '@/components/wall-image-viewer/types';

const mapClass = (boxClass: string) => {
  switch (boxClass) {
    case 'hold':
      return BoxClass.HOLD;
    case 'volume':
      return BoxClass.VOLUME;
    default:
      throw new Error('Invalid class parsed');
  }
};

/**
 *
 * @param {FormData} formData
 * @returns {Array} array of boxes [{x, y, w, h, class}]
 */
const getBoundingBoxes = async (formData: FormData): Promise<Box[]> => {
  try {
    const {
      data: { boxes },
    } = await axios.post(process.env.VUE_APP_GET_BOUNDING_BOX_URL, formData, {
      headers: {
        'Content-Type': 'multipart/formdata',
      },
    });
    return boxes.map((box: Box) => {
      const { x, y, w, h, class: boxClass } = box;
      return {
        x,
        y,
        w,
        h,
        class: mapClass(boxClass),
      };
    });
  } catch (error) {
    console.log(error.response.data);
  }
  return [];
};

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  class: string;
}

export default getBoundingBoxes;
export { Box };
