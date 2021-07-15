<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div id="container">
        <strong>Hello Climbers! &#129495;</strong>
        <p class="lead">
          This is a free open source project between two friends who happen to code and climb.
        </p>

        <p class="lead">
          It aims to accomplish two things:
          <br />
        </p>
        <p class="lead">
          1. Provide a drawing board for custom climbing routes
          <br />
          2. Route sharing system where climbers can search routes by gym, grade and vote
        </p>

        <p class="lead">Please star our repository!</p>

        <ion-button
          target="_blank"
          href="https://github.com/nandium/RouteMaker"
          color="light"
          size="large"
        >
          <ion-icon class="github-logo" :icon="logoGithub" size="medium"></ion-icon>
          Github
        </ion-button>

        <br />
        <br />
        <strong>How To Use</strong>

        <hr class="my-4" id="section2" />
        <p class="lead my-4">1. Upload the photo of a climbing wall</p>
        <img class="screenshot" :src="`${publicPath}assets/screenshots/Screenshot_1.jpg`" />
        <br />
        <br />
        <p class="lead my-4">2. The holds will be marked automatically</p>
        <img class="screenshot" :src="`${publicPath}assets/screenshots/Screenshot_2.jpg`" />
        <br />
        <br />
        <p class="lead my-4">3. Create a custom route by following the prompts</p>
        <img class="screenshot" :src="`${publicPath}assets/screenshots/Screenshot_3.jpg`" />
        <br />
        <br />
        <p class="lead my-4">4. Post to share with other gym goers</p>
        <img class="screenshot" :src="`${publicPath}assets/screenshots/Screenshot_4.jpg`" />
        <br />
        <br />
        <p class="lead my-4">5. Vote, grade and comment on other's routes</p>
        <img class="screenshot" :src="`${publicPath}assets/screenshots/Screenshot_5.jpg`" />
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

export default defineComponent({
  name: 'About',
  components: {
    IonButton,
    IonContent,
    IonIcon,
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
  max-width: 200px;
}

.github-logo {
  margin-right: 15px;
}
</style>
