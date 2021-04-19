import axios from 'axios';

/**
 *
 * @param {FormData} formData
 * @returns {Array} boxes
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
    return boxes;
  } catch (error) {
    console.log(error.response.data);
  }
};

export default getBoundingBox;
