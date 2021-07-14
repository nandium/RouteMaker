<template>
  <ion-page>
    <ion-content :fullscreen="true" v-if="hasLoaded">
      <div id="container" class="ion-text-left">
        <ion-img :src="routeDetails.routeURL"></ion-img>
        <ion-row class="ion-justify-content-between">
          <strong>{{ routeDetails.routeName }}</strong>
          <VoteButton
            :username="routeDetails.username"
            :createdAt="routeDetails.createdAt"
            v-model:voteCount="routeDetails.voteCount"
            v-model:hasVoted="routeDetails.hasVoted"
          ></VoteButton>
        </ion-row>
        <div>
          <b>Route setter's grading:</b>
          V{{ routeDetails.ownerGrade }}
        </div>
        <div>
          <b>Public's grading:</b>
          V{{ routeDetails.publicGrade }}
        </div>
        <div>
          <b>Your grading:</b>
          {{
            routeDetails.graded == -1 ? 'You have not graded this route' : 'V' + routeDetails.graded
          }}
        </div>
        <div v-if="isLoggedIn">
          <br />
          <ion-button
            color="danger"
            @click="() => reportRouteHandler(routeDetails.username, routeDetails.createdAt)"
          >
            <ion-label>Report this route&nbsp;</ion-label>
            <ion-icon :icon="flag"></ion-icon>
          </ion-button>
        </div>
        <br />
        <ion-row
          v-if="!hasAlreadyCommented"
          class="ion-align-items-start ion-justify-content-start"
        >
          <ion-textarea
            placeholder="Write a comment..."
            class="ion-no-margin"
            maxlength="150"
            v-model="commentText"
            autoGrow
          ></ion-textarea>
          <ion-button @click="postCommentHandler" fill="clear" color="dark">
            <ion-icon :icon="sendSharp"></ion-icon>
          </ion-button>
        </ion-row>
        <ion-card
          v-for="({ username, timestamp, comment }, index) in routeDetails.comments"
          :key="index"
        >
          <ion-card-header>
            <ion-card-title>{{ comment }}</ion-card-title>
            <div v-if="isLoggedIn" class="center-right">
              <ion-icon
                class="icon-button"
                v-if="username !== myUsername"
                @click="() => reportCommentHandler(username)"
                :icon="flagOutline"
              ></ion-icon>
              <ion-icon
                class="icon-button"
                v-if="username === myUsername || isAdmin"
                @click="() => deleteCommentHandler(username, timestamp)"
                :icon="trashOutline"
              ></ion-icon>
            </div>
          </ion-card-header>
          <ion-card-content>
            <ion-item class="ion-no-padding">
              <ion-icon class="margin-right" slot="start" :icon="personCircleOutline"></ion-icon>
              <ion-label>{{ username }}</ion-label>
            </ion-item>
          </ion-card-content>
        </ion-card>
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
  IonTextarea,
  alertController,
  toastController,
} from '@ionic/vue';
import { sendSharp, trashOutline, personCircleOutline, flagOutline, flag } from 'ionicons/icons';
import { computed, defineComponent, inject, Ref, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { throttle } from 'lodash';
import axios from 'axios';
import jwt_decode from 'jwt-decode';
import VoteButton from '@/components/VoteButton.vue';

interface Comment {
  username: string;
  timestamp: number;
  comment: string;
}

interface RouteDetails {
  comments?: Array<Comment>;
  countryCode?: string;
  createdAt?: string;
  expiredTime?: string;
  graded?: number;
  gymLocation?: string;
  hasGraded?: boolean;
  hasReported?: boolean;
  hasVoted?: boolean;
  ownerGrade?: number;
  publicGrade?: number;
  routeName?: string;
  routeURL?: string;
  username?: string;
  voteCount?: number;
}

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
    IonTextarea,
    VoteButton,
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const hasLoaded = ref(false);
    const { username, createdAt } = route.params;
    const getLoggedIn: () => Ref<boolean> = inject('getLoggedIn', () => ref(false));
    const getUsername: () => Ref<string> = inject('getUsername', () => ref(''));
    const getAccessToken: () => Ref<string> = inject('getAccessToken', () => ref(''));
    const getIdToken: () => Ref<string> = inject('getIdToken', () => ref(''));
    const commentText = ref('');

    const myUsername = getUsername();
    const isLoggedIn = getLoggedIn();
    const isAdmin = computed(() => {
      try {
        const idObject: { 'custom:role': string } = jwt_decode(getIdToken().value);
        return idObject['custom:role'] === 'admin';
      } catch (error) {
        console.error(error);
        return false;
      }
    });

    const hasAlreadyCommented = ref(false);

    let routeDetails: Ref<RouteDetails> = ref({});

    const updateRouteDetails = throttle(() => {
      const headers = getLoggedIn().value
        ? { Authorization: `Bearer ${getAccessToken().value}` }
        : {};
      axios
        .post(
          process.env.VUE_APP_ROUTE_ENDPOINT_URL + '/route/details',
          {
            username,
            createdAt,
          },
          {
            headers,
          },
        )
        .then((response) => {
          console.log(response);
          if (response.data.Message === 'Get route details success') {
            routeDetails.value = response.data.Item;
            hasAlreadyCommented.value =
              routeDetails.value.comments?.some(
                (comment) => comment.username == myUsername.value,
              ) ?? false;
            hasLoaded.value = true;
          }
        })
        .catch((error) => {
          console.log(error);
          router.back();
        });
    }, 1000);

    updateRouteDetails();

    const postCommentHandler = throttle(() => {
      commentText.value = commentText.value.trim();
      if (commentText.value.length === 0) {
        console.log('Comment cannot be empty');
        return false;
      }
      if (commentText.value.length > 150) {
        console.log('Comment is too long, please keep it within 150 characters');
        return false;
      }

      axios
        .post(
          process.env.VUE_APP_ROUTE_ENDPOINT_URL + '/route/details/comment',
          {
            username,
            createdAt,
            comment: commentText.value,
          },
          {
            headers: {
              Authorization: `Bearer ${getAccessToken().value}`,
            },
          },
        )
        .then((response) => {
          console.log(response);
          updateRouteDetails();
        })
        .catch((error) => {
          console.log(error);
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
            username,
            createdAt,
            commentUsername,
            timestamp: timestamp.toString(),
          },
        })
        .then((response) => {
          console.log(response);
          updateRouteDetails();
        })
        .catch((error) => {
          console.log(error);
        });
    }, 1000);

    const reportCommentHandler = throttle(async (commentUsername: string) => {
      const allowedReasons = [
        '',
        'abusive',
        'inappropriate',
        'spam',
        'racist',
        'beliefs',
        'notlike',
      ];
      let reason = '';
      const alert = await alertController.create({
        cssClass: 'wide',
        header: `Report ${commentUsername}?`,
        message: 'Select your reason for reporting below',
        inputs: [
          {
            type: 'radio',
            label: 'Abusive content',
            value: 'abusive',
            handler: (data) => (reason = data.value),
          },
          {
            type: 'radio',
            label: 'Inappropriate content',
            value: 'inappropriate',
            handler: (data) => (reason = data.value),
          },
          {
            type: 'radio',
            label: "It's spam",
            value: 'spam',
            handler: (data) => (reason = data.value),
          },
          {
            type: 'radio',
            label: 'Racist content',
            value: 'racist',
            handler: (data) => (reason = data.value),
          },
          {
            type: 'radio',
            label: 'It goes against my beliefs',
            value: 'beliefs',
            handler: (data) => (reason = data.value),
          },
          {
            type: 'radio',
            label: "I don't like it",
            value: 'notlike',
            handler: (data) => (reason = data.value),
          },
        ],
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            cssClass: 'secondary',
          },
          {
            text: 'Ok',
            handler: () => {
              if (reason === '' || !allowedReasons.includes(reason)) {
                return false;
              }
              axios
                .post(
                  process.env.VUE_APP_USER_ENDPOINT_URL + '/user/report',
                  {
                    name: commentUsername,
                    reason,
                  },
                  {
                    headers: {
                      Authorization: `Bearer ${getAccessToken().value}`,
                    },
                  },
                )
                .then((response) => {
                  console.log(response);
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
                  console.log(error);
                  toastController
                    .create({
                      header: 'Failed to report user, please try again',
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
                .then((response) => {
                  console.log(response);
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
                  console.log(error);
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

    return {
      routeDetails,
      commentText,
      hasAlreadyCommented,
      postCommentHandler,
      trashOutline,
      personCircleOutline,
      myUsername,
      deleteCommentHandler,
      reportCommentHandler,
      sendSharp,
      hasLoaded,
      isLoggedIn,
      isAdmin,
      flag,
      flagOutline,
      reportRouteHandler,
    };
  },
});
</script>

<style scoped>
#container {
  position: absolute;
  left: 0;
  right: 0;
  max-width: 1000px;
  margin: 0 auto;
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

.icon-button {
  border-radius: 4px;
  padding: 2px;
  margin: 2px;
}

.icon-button:hover {
  background-color: #444444;
  cursor: pointer;
}

ion-textarea {
  border: 1px solid grey;
}

.margin-right {
  margin: 0 10px 0 0;
}
</style>
