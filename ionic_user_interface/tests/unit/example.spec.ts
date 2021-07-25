import { mount } from '@vue/test-utils';
import New from '@/views/New.vue';

describe('New.vue', () => {
  it('renders home vue', () => {
    const wrapper = mount(New);
    expect(wrapper.text()).toMatch('Ready to create an app?');
  });
});
