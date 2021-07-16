<template>
  <ion-page>
    <ion-content :fullscreen="true" v-if="hasLoaded">
      <div id="container" class="ion-text-left">
        <ion-img :src="routeDetails.routeURL"></ion-img>
        <ion-row class="ion-justify-content-between">
          <div class="route-title">
            <b>{{ routeDetails.routeName }}</b>
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
            class="ion-no-padding margin-left rounded"
            :href="'/userRoutes/' + routeDetails.username"
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
              <ion-label>Report this route&nbsp;</ion-label>
              <ion-icon :icon="flag"></ion-icon>
            </ion-button>
            <ion-button disabled v-if="hasReported" color="medium">
              <ion-label>Reported</ion-label>
            </ion-button>
          </div>
        </ion-row>
        <div class="ion-padding">
          <b>Route setter's {{ isRouteSetter ? '(you)' : '' }} grading:</b>
          <GradeSlider :value="routeDetails.ownerGrade" :disabled="!isRouteSetter"></GradeSlider>
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
            :changeHandler="gradeChangeHandler"
          ></GradeSlider>
        </div>
        <br />
        <MessageBox ref="msgBox" color="danger" class="rounded margin" />
        <div class="margin-left margin-right">
          <ion-row
            v-if="isLoggedIn && !hasAlreadyCommented"
            class="ion-align-items-start ion-justify-content-start margin"
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
            <br />
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
            <ion-card-content class="ion-no-padding ion-no-margin display-flex">
              <ion-item
                class="ion-no-padding margin-left-large rounded"
                :href="'/userRoutes/' + username"
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
import { getAlertController } from '@/common/reportUserAlert';
import VoteButton from '@/components/VoteButton.vue';
import GradeSlider from '@/components/GradeSlider.vue';
import MessageBox from '@/components/MessageBox.vue';

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
    GradeSlider,
    MessageBox,
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

    const asciiPattern = /^[ -~]+$/;
    const msgBox: Ref<typeof MessageBox | null> = ref(null);

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
    const isRouteSetter = computed(() => username === myUsername.value);

    const hasAlreadyCommented = ref(false);

    const hasReported = ref(false);

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
          if (response.data.Message === 'Get route details success') {
            routeDetails.value = response.data.Item;
            console.log(routeDetails.value);
            hasAlreadyCommented.value =
              routeDetails.value.comments?.some(
                (comment) => comment.username == myUsername.value,
              ) ?? false;
            hasReported.value = routeDetails.value.hasReported ?? false;
            hasLoaded.value = true;
          }
        })
        .catch((error) => {
          console.error(error);
          router.back();
        });
    }, 1000);

    updateRouteDetails();

    const postCommentHandler = throttle(() => {
      msgBox.value?.close();
      commentText.value = commentText.value.trim();
      if (commentText.value.length === 0) {
        msgBox.value?.showMsg('Comment cannot be empty');
        return false;
      }
      if (commentText.value.length > 150) {
        msgBox.value?.showMsg('Comment is too long, please keep it within 150 characters');
        return false;
      }
      if (!asciiPattern.test(commentText.value)) {
        msgBox.value?.showMsg('Comment cannot contain non-ASCII characters');
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
        .then(() => {
          updateRouteDetails();
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
            username,
            createdAt,
            commentUsername,
            timestamp: timestamp.toString(),
          },
        })
        .then(() => {
          updateRouteDetails();
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
            username,
            createdAt,
            grade,
          },
          {
            headers: {
              Authorization: `Bearer ${getAccessToken().value}`,
            },
          },
        )
        .then(() => {
          updateRouteDetails();
        })
        .catch((error) => {
          console.error(error);
        });
    };

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
      hasReported,
      msgBox,
      gradeChangeHandler,
      isRouteSetter,
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
  font-size: clamp(2rem, 7vw, 2.5rem);
  margin: 20px 30px 20px 10px;
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
</style>
