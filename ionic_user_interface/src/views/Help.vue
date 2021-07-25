<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="my-container">
        <strong>-- Hello Climbers! --</strong>
        <p>This is a free open source project between friends who happen to code and climb.</p>

        <p>It aims to provide the following features:</p>
        <div class="features-div">
          <ol class="ion-text-start">
            <li>
              <b>AI Drawing Board</b>
              - Draw custom climbing routes faster with a climbing hold detection model
            </li>
            <li>
              <b>Route Sharing System</b>
              - Climbers can search, grade and vote for other user-created routes
            </li>
            <li>
              <b>Ease of Access</b>
              - No signup or installation is necessary for searching and viewing of routes
            </li>
          </ol>
        </div>

        <p>
          We plan to maintain this project for as long as people find it useful.
          <br />
          If you like our work, please star our repository. Pull requests are welcomed too!
        </p>

        <ion-button
          target="_blank"
          href="https://github.com/nandium/RouteMaker"
          title="Our GitHub repository"
          color="light"
          size="medium"
          class="logo-button"
        >
          <ion-icon :icon="logoGithub" size="medium"></ion-icon>
          Github
        </ion-button>
        <ion-button
          target="_blank"
          href="mailto:routemakergithub@gmail.com"
          title="Email us!"
          color="light"
          size="medium"
          class="logo-button"
        >
          <ion-icon :icon="mail" size="medium"></ion-icon>
          Feedback
        </ion-button>
        <br />
        <br />
        <br />
        <strong>-- How To Use --</strong>
        <div class="slides-container">
          <div class="slides-arrow left-align" @click="prevSlide">
            <ion-icon :icon="chevronBack"></ion-icon>
          </div>
          <div class="slides-arrow right-align" @click="nextSlide">
            <ion-icon :icon="chevronForward"></ion-icon>
          </div>
          <ion-slides pager="true" ref="ionSlides">
            <ion-slide>
              <div>
                <p>1. Upload the photo of a climbing wall</p>
                <img :src="`${publicPath}assets/screenshots/Screenshot_1.jpg`" />
              </div>
            </ion-slide>
            <ion-slide>
              <div>
                <p>2. The holds will be marked automatically</p>
                <img :src="`${publicPath}assets/screenshots/Screenshot_2.jpg`" />
              </div>
            </ion-slide>
            <ion-slide>
              <div>
                <p>3. Create a custom route by following the prompts</p>
                <img :src="`${publicPath}assets/screenshots/Screenshot_3.jpg`" />
              </div>
            </ion-slide>
            <ion-slide>
              <div>
                <p>4. Post to share with other gym goers</p>
                <img :src="`${publicPath}assets/screenshots/Screenshot_4.jpg`" />
              </div>
            </ion-slide>
            <ion-slide>
              <div>
                <p>5. Vote, grade and comment on other's routes</p>
                <img :src="`${publicPath}assets/screenshots/Screenshot_5.jpg`" />
              </div>
            </ion-slide>
          </ion-slides>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import { logoGithub, mail, chevronBack, chevronForward } from 'ionicons/icons';
import { IonButton, IonContent, IonIcon, IonPage, IonSlide, IonSlides } from '@ionic/vue';
import { defineComponent, Ref, ref } from 'vue';

export default defineComponent({
  name: 'Help',
  components: {
    IonButton,
    IonContent,
    IonIcon,
    IonPage,
    IonSlide,
    IonSlides,
  },
  setup() {
    const publicPath = process.env.BASE_URL;
    const ionSlides: Ref<typeof IonSlides | null> = ref(null);
    const nextSlide = () => ionSlides.value?.$el.slideNext();
    const prevSlide = () => ionSlides.value?.$el.slidePrev();
    return {
      ionSlides,
      nextSlide,
      prevSlide,
      logoGithub,
      publicPath,
      mail,
      chevronBack,
      chevronForward,
    };
  },
});
</script>

<style scoped lang="scss">
.my-container {
  text-align: center;
  margin: 0 auto;
  padding: 20px 2%;

  strong {
    font-size: clamp(1.5rem, 7vw, 1.8rem);
    line-height: 2em;
  }

  p {
    font-size: 1.1em;
    line-height: 1.4em;
    margin-left: 0.5rem;
    margin-right: 0.5rem;
  }

  li {
    font-size: 1.1em;
  }
}

.slides-container {
  position: relative;
  display: block;
  width: clamp(280px, 60%, 330px);
  margin: 0 auto;
  padding: 0;

  .slides-arrow {
    position: absolute;
    z-index: 999;
    display: flex;
    height: 100%;
    width: 60%;
    align-items: center;

    &:hover {
      cursor: pointer;
      background: rgba(var(--ion-color-secondary-rgb), 0.05);
    }

    ion-icon {
      height: 20px;
      width: 20px;
    }
  }

  ion-slides {
    --bullet-background: var(--ion-color-medium);

    img {
      border: 1.5px solid grey;
      width: clamp(280px, 60%, 330px);
      margin: 0 auto;
      margin-bottom: 30px;
      image-rendering: -webkit-optimize-contrast;
      /* https://stackoverflow.com/questions/37906602/blurry-downscaled-images-in-chrome */
    }
  }
}

.left-align {
  left: -10%;
  text-align: left;
  justify-content: flex-start;
  padding-left: 5px;
}

.right-align {
  right: -10%;
  text-align: right;
  justify-content: flex-end;
  padding-right: 5px;
}

.features-div {
  max-width: 600px;
  margin: 0 auto;
  border-radius: 15px;
  border: 1px solid grey;
  padding: 0.2rem 1rem;

  ol {
    margin-left: -15px;
    margin-right: 0;

    li {
      padding-bottom: 10px;
    }
  }
}

.logo-button {
  margin: 10px;

  ion-icon {
    margin-right: 10px;
  }
}
</style>
