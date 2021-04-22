import axios from 'axios';
import BoxClass from '@/common/enumBoxClass';

/**
 *
 * @param {FormData} formData
 * @returns {Array} array of boxes [{x, y, w, h, class}]
 */
const getBoundingBox = async (formData) => {
  try {
    const {
      data: { boxes },
    } = await axios.post(process.env.VUE_APP_GET_BOUNDING_BOX_URL, formData, {
      headers: {
        'Content-Type': 'multipart/formdata',
      },
    });
    return boxes.map((box) => {
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
};

const mapClass = (boxClass) => {
  switch (boxClass) {
    case 'hold':
      return BoxClass.HOLD;
    case 'volume':
      return BoxClass.VOLUME;
    default:
      throw new Error('Invalid class parsed');
  }
};

export default getBoundingBox;
