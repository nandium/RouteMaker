<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div id="container">
        <strong>-- Hello Climbers! --</strong>
        <p class="lead">
          This is a free open source project between two friends who happen to code and climb.
        </p>

        <p class="lead">
          It aims to provide two features:
          <br />
        </p>
        <div class="features-div">
          <p class="lead ion-text-start">
            1. Provide a drawing board for custom climbing routes
            <br />
            2. Route sharing system where climbers can search routes by gym, grade and vote
          </p>
        </div>

        <p class="lead">Please star our repository to support!</p>

        <ion-button
          target="_blank"
          href="https://github.com/nandium/RouteMaker"
          color="light"
          size="medium"
        >
          <ion-icon class="github-logo" :icon="logoGithub" size="medium"></ion-icon>
          Github
        </ion-button>

        <br />
        <br />
        <br />
        <strong>-- How To Use --</strong>

        <p class="lead my-4">1. Upload the photo of a climbing wall</p>
        <ion-img class="screenshot" :src="`${publicPath}assets/screenshots/Screenshot_1.jpg`" />
        <br />
        <p class="lead my-4">2. The holds will be marked automatically</p>
        <ion-img class="screenshot" :src="`${publicPath}assets/screenshots/Screenshot_2.jpg`" />
        <br />
        <p class="lead my-4">3. Create a custom route by following the prompts</p>
        <ion-img class="screenshot" :src="`${publicPath}assets/screenshots/Screenshot_3.jpg`" />
        <br />
        <p class="lead my-4">4. Post to share with other gym goers</p>
        <ion-img class="screenshot" :src="`${publicPath}assets/screenshots/Screenshot_4.jpg`" />
        <br />
        <p class="lead my-4">5. Vote, grade and comment on other's routes</p>
        <ion-img class="screenshot" :src="`${publicPath}assets/screenshots/Screenshot_5.jpg`" />
        <br />
      </div>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { logoGithub } from 'ionicons/icons';
import { IonButton, IonContent, IonIcon, IonImg, IonPage } from '@ionic/vue';
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'Help',
  components: {
    IonButton,
    IonContent,
    IonIcon,
    IonImg,
    IonPage,
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
  font-size: 1.8em;
  line-height: 2em;
}

#container p {
  font-size: 1.1em;
  line-height: 1.4em;
}

#container a {
  text-decoration: none;
}

.screenshot {
  border: 1.5px solid grey;
  max-width: 250px;
  margin: 0 auto;
  image-rendering: -webkit-optimize-contrast;
  /* https://stackoverflow.com/questions/37906602/blurry-downscaled-images-in-chrome */
}

.features-div {
  max-width: 500px;
  margin: 0 auto;
  border-radius: 15px;
  border: 1px solid grey;
  padding: 0.2rem 1rem;
}

.github-logo {
  margin-right: 15px;
}
</style>
