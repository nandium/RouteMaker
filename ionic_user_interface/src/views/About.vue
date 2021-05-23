<template>
  <ion-page>
    <Header />
    <ion-content :fullscreen="true">
      <div id="container">
        <strong>Hello Climbers! &#129495;</strong>
        <p class="lead">
          Personally, when people make routes for me at the gym,
          <br />
          I tend to forget half of the moves due to my poor memory.
        </p>

        <p class="lead">
          One way is to draw them out on a handphone,
          <br />
          but it is difficult to do so with fat fingers, and labeling
          <br />
          the exact order of moves can be troublesome too.
        </p>
        <p class="lead">This application aims to solve this issue.</p>

        <hr class="my-4" id="section2" />
        <p class="lead my-4">1. Upload the photo of a climbing wall</p>
        <img class="screenshot" :src="`${publicPath}assets/screenshots/Screenshot_1.jpg`" />
        <br />
        <br />
        <p class="lead my-4">2. The holds will be marked automatically</p>
        <img class="screenshot" :src="`${publicPath}assets/screenshots/Screenshot_2.jpg`" />
        <br />
        <br />
        <p class="lead my-4">3. Select your handholds</p>
        <img class="screenshot" :src="`${publicPath}assets/screenshots/Screenshot_3.jpg`" />
        <br />
        <br />
        <p class="lead my-4">4. Select your footholds</p>
        <img class="screenshot" :src="`${publicPath}assets/screenshots/Screenshot_4.jpg`" />
        <br />
        <br />
        <p class="lead my-4">5. Select number of start holds</p>
        <img class="screenshot" :src="`${publicPath}assets/screenshots/Screenshot_5.jpg`" />
        <br />
        <br />
        <p class="lead my-4">6. Export as an image to share with friends</p>
        <img class="screenshot" :src="`${publicPath}assets/screenshots/Screenshot_6.jpg`" />
        <br />
        <br />

        <hr class="my-4" />
        <p class="lead my-4">Pull requests are welcomed!</p>
        <ion-button
          target="_blank"
          href="https://github.com/yarkhinephyo/yolo_bouldering"
          color="light"
          size="large"
        >
          <ion-icon class="github-logo" :icon="logoGithub" size="large"></ion-icon>
          GitHub
        </ion-button>
        <br />
        <br />
      </div>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { logoGithub } from 'ionicons/icons';
import { IonButton, IonContent, IonIcon, IonPage } from '@ionic/vue';
import { defineComponent } from 'vue';
import Header from '../components/Header.vue';

export default defineComponent({
  name: 'About',
  components: {
    IonButton,
    IonContent,
    IonIcon,
    IonPage,
    Header,
  },
  setup() {
    const publicPath = process.env.BASE_URL;
    return {
      logoGithub,
      publicPath,
    };
  },
});
</script>

<style scoped>
#container {
  text-align: center;
  position: absolute;
  left: 2%;
  right: 2%;
  z-index: -1;
  padding-top: 30px;
}

#container strong {
  font-size: 2em;
  line-height: 2em;
}

#container p {
  font-size: 1.3em;
  line-height: 1.5em;
}

#container a {
  text-decoration: none;
}

.screenshot {
  border-radius: 15px;
  border: 2px solid grey;
}

.github-logo {
  margin-right: 15px;
}
</style>
