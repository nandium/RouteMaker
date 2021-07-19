<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <ion-spinner v-if="isLoading" name="crescent"></ion-spinner>
      <div v-if="!isLoading" id="container" class="ion-text-left">
        <ion-img :src="routeDetails.routeURL"></ion-img>
        <ion-row class="ion-justify-content-between">
          <div class="route-title">
            <b>{{ routeDetails.routeName }}</b>
          </div>
          <div class="share-button-div icon-button margin-right" @click="sharePostHandler">
            <ion-icon size="large" :icon="shareSocialOutline"></ion-icon>
          </div>
          <VoteButton
            class="margin-right"
            :username="routeDetails.username"
            :createdAt="routeDetails.createdAt"
            v-model:voteCount="routeDetails.voteCount"
            v-model:hasVoted="routeDetails.hasVoted"
          ></VoteButton>
        </ion-row>
        <ion-row class="ion-justify-content-between display-flex">
          <ion-item
            class="ion-no-padding margin-left rounded profile-item"
            @click="() => router.push({ name: 'UserRoutes', params: routeDetails.username })"
          >
            <ion-icon
              class="margin-right margin-left"
              slot="start"
              :icon="personCircleOutline"
            ></ion-icon>
            <ion-label class="align-middle">{{ routeDetails.username }}</ion-label>
          </ion-item>
          <div v-if="isLoggedIn && !isRouteSetter" class="margin-right margin-left">
            <ion-button
              v-if="!hasReported"
              color="danger"
              @click="() => reportRouteHandler(routeDetails.username, routeDetails.createdAt)"
            >
              <ion-label>Report route&nbsp;</ion-label>
              <ion-icon :icon="flag"></ion-icon>
            </ion-button>
            <ion-button disabled v-if="hasReported" color="medium">
              <ion-label>Reported</ion-label>
            </ion-button>
          </div>
        </ion-row>
        <div class="ion-padding">
          <b>Route setter's {{ isRouteSetter ? '(you)' : '' }} grading:</b>
          <GradeSlider
            :value="routeDetails.ownerGrade"
            :disabled="!isRouteSetter"
            :changeHandler="isRouteSetter ? gradeChangeHandler : () => undefined"
          ></GradeSlider>
        </div>
        <div class="ion-padding">
          <b>Public's grading:</b>
          <GradeSlider :value="routeDetails.publicGrade" :disabled="true"></GradeSlider>
        </div>
        <div class="ion-padding" v-if="isLoggedIn && !isRouteSetter">
          <b>Your grading:</b>
          {{ routeDetails.graded == -1 ? 'You have not graded this route' : '' }}
          <GradeSlider
            :value="routeDetails.graded == -1 ? 0 : routeDetails.graded"
            :changeHandler="isRouteSetter ? () => undefined : gradeChangeHandler"
          ></GradeSlider>
        </div>
        <br />
        <MessageBox ref="msgBox" color="danger" class="rounded margin" />
        <div class="margin-left margin-right">
          <h1 class="ion-text-center ion-margin">-- Comments --</h1>
          <ion-row
            v-if="isLoggedIn && !hasAlreadyCommented"
            class="ion-align-items-start ion-justify-content-start margin"
          >
            <ion-textarea
              placeholder="Write a comment..."
              class="ion-no-margin"
              maxlength="150"
              v-model="commentText"
            ></ion-textarea>
            <ion-button @click="postCommentHandler" fill="clear" color="dark">
              <ion-icon :icon="sendSharp"></ion-icon>
            </ion-button>
            <br />
          </ion-row>
          <ion-card
            v-for="({ username, timestamp, comment }, index) in routeDetails.comments"
            :key="index"
          >
            <ion-card-header>
              <ion-card-title>{{ comment }}</ion-card-title>
              <div v-if="isLoggedIn" class="center-right">
                <div
                  class="icon-button"
                  v-if="username !== myUsername"
                  @click="() => reportCommentHandler(username)"
                >
                  <ion-icon :icon="flagOutline"></ion-icon>
                </div>
                <div
                  v-if="username === myUsername || isAdmin"
                  class="icon-button"
                  @click="() => deleteCommentHandler(username, timestamp)"
                >
                  <ion-icon :icon="trashOutline"></ion-icon>
                </div>
              </div>
            </ion-card-header>
            <ion-card-content class="ion-no-padding ion-no-margin display-flex">
              <ion-item
                class="ion-no-padding margin-left-large rounded profile-item"
                @click="() => router.push({ name: 'UserRoutes', params: username })"
              >
                <ion-icon
                  class="margin-right margin-left"
                  slot="start"
                  :icon="personCircleOutline"
                ></ion-icon>
                <ion-label class="align-middle">{{ username }}</ion-label>
              </ion-item>
            </ion-card-content>
          </ion-card>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script lang="ts">
import {
  IonButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonContent,
  IonIcon,
  IonImg,
  IonItem,
  IonLabel,
  IonPage,
  IonRow,
  IonSpinner,
  IonTextarea,
  alertController,
  toastController,
} from '@ionic/vue';
import {
  sendSharp,
  trashOutline,
  personCircleOutline,
  flagOutline,
  flag,
  shareSocialOutline,
} from 'ionicons/icons';
import { computed, ComputedRef, defineComponent, inject, Ref, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { throttle } from 'lodash';
import axios from 'axios';

import { getAlertController } from '@/common/reportUserAlert';
import VoteButton from '@/components/VoteButton.vue';
import GradeSlider from '@/components/GradeSlider.vue';
import MessageBox from '@/components/MessageBox.vue';
import { shareSocial } from '@/common/shareSocial';
import getRouteDetails, { RouteDetails } from '@/common/api/route/getRouteDetails';

export default defineComponent({
  name: 'ViewRoute',
  components: {
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonIcon,
    IonImg,
    IonItem,
    IonLabel,
    IonPage,
    IonRow,
    IonSpinner,
    IonTextarea,
    GradeSlider,
    MessageBox,
    VoteButton,
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const username = computed(() => route.params.username as string);
    const createdAt = computed(() => route.params.createdAt as string);
    const getLoggedIn: () => Ref<boolean> = inject('getLoggedIn', () => ref(false));
    const getUsername: () => Ref<string> = inject('getUsername', () => ref(''));
    const getAccessToken: () => Ref<string> = inject('getAccessToken', () => ref(''));
    const getUserRole: () => ComputedRef<string> = inject('getUserRole', () => computed(() => ''));
    const commentText = ref('');

    const asciiPattern = /^[ -~]+$/;
    const msgBox: Ref<typeof MessageBox | null> = ref(null);

    const myUsername = getUsername();
    const isLoggedIn = getLoggedIn();
    const isAdmin = computed(() => getUserRole().value === 'admin');
    const isRouteSetter = computed(() => username.value === myUsername.value);
    const hasAlreadyCommented = ref(false);
    const hasReported = ref(false);

    const isLoading = ref(false);

    let routeDetails: Ref<RouteDetails | null> = ref(null);

    const updateRouteDetails = throttle(async (showLoadingScreen = true) => {
      if (isLoading.value) {
        return;
      }
      isLoading.value = showLoadingScreen;
      try {
        const data = await getRouteDetails(username.value, createdAt.value);
        if (data.Message === 'Get route details success') {
          routeDetails.value = data.Item;
          hasAlreadyCommented.value =
            routeDetails.value?.comments.some((comment) => comment.username == myUsername.value) ??
            false;
          hasReported.value = routeDetails.value?.hasReported ?? false;
        } else {
          throw new Error('Failed to get route details');
        }
      } catch (error) {
        console.error(error);
        router.back();
      } finally {
        isLoading.value = false;
      }
    }, 1000);

    updateRouteDetails();

    const postCommentHandler = throttle(() => {
      msgBox.value?.close();
      const comment = commentText.value.trim();
      commentText.value = '';
      if (comment.length === 0) {
        msgBox.value?.showMsg('Comment cannot be empty');
        return false;
      }
      if (comment.length > 150) {
        msgBox.value?.showMsg('Comment is too long, please keep it within 150 characters');
        return false;
      }
      if (!asciiPattern.test(comment)) {
        msgBox.value?.showMsg('Comment cannot contain non-ASCII characters');
        return false;
      }

      axios
        .post(
          process.env.VUE_APP_ROUTE_ENDPOINT_URL + '/route/details/comment',
          {
            username: username.value,
            createdAt: createdAt.value,
            comment,
          },
          {
            headers: {
              Authorization: `Bearer ${getAccessToken().value}`,
            },
          },
        )
        .then(() => {
          updateRouteDetails(false);
        })
        .catch((error) => {
          console.error(error);
        });

      return true;
    }, 1000);

    const deleteCommentHandler = throttle((commentUsername: string, timestamp: number) => {
      axios
        .delete(process.env.VUE_APP_ROUTE_ENDPOINT_URL + '/route/details/comment', {
          headers: {
            Authorization: `Bearer ${getAccessToken().value}`,
          },
          params: {
            username: username.value,
            createdAt: createdAt.value,
            commentUsername,
            timestamp: timestamp.toString(),
          },
        })
        .then(() => {
          updateRouteDetails(false);
        })
        .catch((error) => {
          console.error(error);
        });
    }, 1000);

    const reportCommentHandler = throttle(async (commentUsername: string) => {
      const alert = await getAlertController(commentUsername, getAccessToken().value);
      return alert.present();
    }, 1000);

    const reportRouteHandler = throttle(async (routeUsername: string, createdAt: string) => {
      const alert = await alertController.create({
        cssClass: 'wide',
        header: `Report this route?`,
        message: 'Are you sure?',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            cssClass: 'secondary',
          },
          {
            text: 'Yes',
            handler: () => {
              axios
                .post(
                  process.env.VUE_APP_ROUTE_ENDPOINT_URL + '/route/details/report',
                  {
                    username: routeUsername,
                    createdAt,
                  },
                  {
                    headers: {
                      Authorization: `Bearer ${getAccessToken().value}`,
                    },
                  },
                )
                .then(() => {
                  hasReported.value = true;
                  toastController
                    .create({
                      header: 'Your report has been successfully sent',
                      position: 'bottom',
                      color: 'success',
                      duration: 3000,
                      buttons: [
                        {
                          text: 'Close',
                          role: 'cancel',
                        },
                      ],
                    })
                    .then((toast) => {
                      toast.present();
                    });
                })
                .catch((error) => {
                  console.error(error);
                  toastController
                    .create({
                      header: 'Failed to report route, please try again',
                      position: 'bottom',
                      color: 'danger',
                      duration: 3000,
                      buttons: [
                        {
                          text: 'Close',
                          role: 'cancel',
                        },
                      ],
                    })
                    .then((toast) => {
                      toast.present();
                    });
                });
            },
          },
        ],
      });
      return alert.present();
    }, 1000);

    const gradeChangeHandler = (grade: number) => {
      if (!isLoggedIn.value) {
        return;
      }
      axios
        .post(
          process.env.VUE_APP_ROUTE_ENDPOINT_URL + '/route/details/grade',
          {
            username: username.value,
            createdAt: createdAt.value,
            grade,
          },
          {
            headers: {
              Authorization: `Bearer ${getAccessToken().value}`,
            },
          },
        )
        .then(() => {
          updateRouteDetails(false);
        })
        .catch((error) => {
          console.error(error);
        });
    };

    const sharePostHandler = async () => {
      await shareSocial(route, `Route by ${username.value}`);
    };

    return {
      router,
      routeDetails,
      commentText,
      hasAlreadyCommented,
      postCommentHandler,
      trashOutline,
      personCircleOutline,
      shareSocialOutline,
      myUsername,
      deleteCommentHandler,
      reportCommentHandler,
      sendSharp,
      isLoggedIn,
      isAdmin,
      flag,
      flagOutline,
      reportRouteHandler,
      hasReported,
      msgBox,
      gradeChangeHandler,
      sharePostHandler,
      isRouteSetter,
      isLoading,
    };
  },
});
</script>

<style scoped>
#container {
  position: absolute;
  left: 0;
  right: 0;
  max-width: 900px;
  margin: 0 auto;
  padding: 0;
}

#container strong {
  font-size: 3em;
  line-height: 2em;
}

#container p {
  font-size: 1.6em;
  line-height: 1em;
  color: #8c8c8c;
  margin: 0;
}

#container a {
  text-decoration: none;
}

.center-right {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 25px;
  margin: 0;
}

.route-title {
  flex: 1;
  vertical-align: middle;
  font-size: clamp(1.6rem, 7vw, 2.5rem);
  margin: 20px 30px 20px 16px;
}

.icon-button {
  border-radius: 4px;
  width: 30px;
  height: 30px;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-button:hover {
  background-color: #444444;
  cursor: pointer;
}

ion-textarea {
  border: 1px solid grey;
  border-radius: 5px;
}

.align-middle {
  margin: 0;
  padding: 0;
  align-self: center;
  vertical-align: middle;
}

.margin-left {
  margin-left: 10px;
}

.margin-left-large {
  margin-left: 1em;
}

.margin-right {
  margin-right: 10px;
}

ion-card {
  margin: 0px 0 20px 0;
  padding-bottom: 10px;
}

.rounded {
  border-radius: 5px;
}

.margin {
  margin-bottom: 1.4em;
}

.comment-card-item {
  display: inline;
}

.display-flex {
  display: flex;
}

.profile-item:hover {
  cursor: pointer;
  --background: #333333;
}

ion-spinner {
  position: absolute;
  height: 100px;
  width: 100px;
  top: 50%;
  left: 50%;
  margin-left: -50px;
  margin-top: -50px;
}

.share-button-div {
  display: flex;
  align-self: center;
}
</style>
