<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <ion-spinner v-if="isLoading" name="crescent"></ion-spinner>
      <div v-if="!isLoading" class="my-container ion-text-left">
        <ion-img :src="routeDetails.routeURL"></ion-img>
        <ion-row class="ion-justify-content-between">
          <div class="route-title" title="Route name">
            <b>{{ routeDetails.routeName }}</b>
          </div>
          <div
            title="Share route"
            class="global-margin-right icon-button share-button-div"
            @click="sharePostHandler"
          >
            <ion-icon color="tertiary" size="large" :icon="shareSocialOutline"></ion-icon>
          </div>
          <VoteButton
            title="Upvote route"
            class="global-margin-right"
            :username="routeDetails.username"
            :createdAt="routeDetails.createdAt"
            v-model:voteCount="routeDetails.voteCount"
            v-model:hasVoted="routeDetails.hasVoted"
          ></VoteButton>
        </ion-row>
        <ion-row class="ion-justify-content-between display-flex">
          <ion-item
            class="ion-no-padding global-margin-left global-rounded profile-item"
            title="Go to profile"
            lines="none"
            @click="() => router.push({ name: 'UserRoutes', params: routeDetails.username })"
          >
            <ion-icon
              class="global-margin-left-right"
              slot="start"
              :icon="personCircleOutline"
            ></ion-icon>
            <ion-label class="align-middle">{{ routeDetails.username }}</ion-label>
          </ion-item>
          <div
            v-if="isLoggedIn && !isRouteSetter"
            title="Report route"
            class="global-margin-left-right"
          >
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
        <div class="global-margin-left-right">
          <h1 class="ion-text-center ion-margin comment-title">
            -- Comments ({{ routeDetails.comments.length }}) --
          </h1>
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
          <ion-card v-for="(commentDetails, index) of routeDetails.comments" :key="index">
            <ion-card-header>
              <ion-card-title>{{ commentDetails.comment }}</ion-card-title>
              <div v-if="isLoggedIn" class="center-right">
                <div
                  v-if="commentDetails.username !== myUsername"
                  title="Report comment"
                  class="icon-button"
                  @click="() => reportCommentHandler(commentDetails.username)"
                >
                  <ion-icon :icon="flagOutline"></ion-icon>
                </div>
                <div
                  v-if="commentDetails.username === myUsername || isAdmin"
                  title="Delete comment"
                  class="icon-button"
                  @click="
                    () => deleteCommentHandler(commentDetails.username, commentDetails.timestamp)
                  "
                >
                  <ion-icon :icon="trashOutline"></ion-icon>
                </div>
              </div>
            </ion-card-header>
            <ion-card-content class="ion-no-padding ion-no-margin display-flex">
              <ion-item
                title="Go to user profile"
                class="ion-no-padding margin-left-large global-rounded profile-item"
                lines="none"
                @click="() => router.push({ name: 'UserRoutes', params: commentDetails.username })"
              >
                <ion-icon
                  class="global-margin-left-right"
                  slot="start"
                  :icon="personCircleOutline"
                ></ion-icon>
                <ion-label class="align-middle">{{ commentDetails.username }}</ion-label>
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
  onIonViewWillEnter,
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
import addCommentToRoute from '@/common/api/route/addCommentToRoute';
import changeRouteGrade from '@/common/api/route/changeRouteGrade';

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

    onIonViewWillEnter(updateRouteDetails);

    const postCommentHandler = throttle(async () => {
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

      hasAlreadyCommented.value = true;
      try {
        const data = await addCommentToRoute(username.value, createdAt.value, comment);
        if (data.Message === 'Comment route success') {
          // Add as the first comment in the list
          routeDetails.value?.comments.unshift(data.Item);
        } else {
          hasAlreadyCommented.value = false;
          throw new Error('Failed to add comment');
        }
      } catch (error) {
        msgBox.value?.showMsg('Please try again in a while');
        console.error(error);
      }

      return true;
    }, 1000);

    const deleteCommentHandler = throttle(async (commentUsername: string, timestamp: number) => {
      msgBox.value?.close();
      const alert = await alertController.create({
        header: `Delete comment?`,
        message: 'Are you sure?',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
          },
          {
            text: 'Delete',
            cssClass: 'global-danger-text',
            handler: () => {
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
                .then((response) => {
                  if (response.data.Message === 'Delete comment success') {
                    if (routeDetails.value) {
                      // Username may be different from commentUsername when it is an admin delete
                      routeDetails.value.comments = routeDetails.value?.comments.filter(
                        (comment) => {
                          return (
                            comment.username !== commentUsername && comment.timestamp !== timestamp
                          );
                        },
                      );
                      hasAlreadyCommented.value = false;
                    }
                  }
                })
                .catch((error) => {
                  msgBox.value?.showMsg('Please try again in a while');
                  console.error(error);
                });
            },
          },
        ],
      });
      return alert.present();
    }, 1000);

    const reportCommentHandler = throttle(async (commentUsername: string) => {
      const alert = await getAlertController(commentUsername, getAccessToken().value);
      return alert.present();
    }, 1000);

    const reportRouteHandler = throttle(async (routeUsername: string, createdAt: string) => {
      const alert = await alertController.create({
        cssClass: 'global-wide',
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

    const gradeChangeHandler = throttle(async (grade: number) => {
      msgBox.value?.close();
      if (!isLoggedIn.value) {
        return;
      }
      try {
        const data = await changeRouteGrade(username.value, createdAt.value, grade);
        if (data.Message === 'Grade route success') {
          if (routeDetails.value) {
            routeDetails.value.graded = grade;
            routeDetails.value.ownerGrade = data.Item.ownerGrade;
            routeDetails.value.publicGrade = data.Item.publicGrade;
          }
        }
      } catch (error) {
        msgBox.value?.showMsg('Please try again in a while');
        console.error(error);
      }
    }, 500);

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

<style scoped lang="scss">
.my-container {
  max-width: 900px;
  margin: 0 auto;
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
  font-size: clamp(1.6em, 3vw, 2em);
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

  &:hover {
    background-color: var(--ion-color-light-tint);
    cursor: pointer;
  }
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

.margin-left-large {
  margin-left: 1em;
}

ion-card {
  margin: 0px 0 20px 0;
  padding-bottom: 10px;
}

.margin {
  margin-bottom: 1.4em;
}

h1.comment-title {
  font-size: clamp(1.4em, 3vw, 1.6em);
}

.comment-card-item {
  display: inline;
}

.display-flex {
  display: flex;
}

.profile-item {
  ion-label {
    color: var(--ion-color-medium);
  }

  &:hover {
    cursor: pointer;
    --background: var(--ion-color-light-tint);
  }
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

/* To prevent clash with delete icon on the right */
ion-card-title {
  margin-right: 40px;
  font-size: clamp(1.2em, 3vw, 1.4em);
}
</style>
