<template>
  <ion-page>
    <ion-content :fullscreen="true" v-if="hasLoaded">
      <div id="container" class="ion-text-left">
        <ion-img :src="routeDetails.routeURL"></ion-img>
        <strong>{{ routeDetails.routeName }}</strong>
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
            <div
              v-if="username === myUsername.value"
              class="center-right"
              @click="() => deleteCommentHandler(username, timestamp)"
            >
              <ion-icon :icon="trashOutline"></ion-icon>
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
} from '@ionic/vue';
import { sendSharp } from 'ionicons/icons';
import { trashOutline, personCircleOutline } from 'ionicons/icons';
import { computed, defineComponent, inject, Ref, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';

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
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const hasLoaded = ref(false);
    const { username, createdAt } = route.params;
    const getUsername: () => Ref<string> = inject('getUsername', () => ref(''));
    const getAccessToken: () => Ref<string> = inject('getAccessToken', () => ref(''));
    const commentText = ref('');

    const myUsername = computed(getUsername);

    const hasAlreadyCommented = ref(false);

    let routeDetails: Ref<RouteDetails> = ref({});

    const updateRouteDetails = () =>
      axios
        .post(
          process.env.VUE_APP_ROUTE_ENDPOINT_URL + '/route/details',
          {
            username,
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
          if (response.data.Message === 'Get route details success') {
            routeDetails.value = response.data.Item;
            hasAlreadyCommented.value = false;
            if (routeDetails.value.comments) {
              for (const comment of routeDetails.value.comments) {
                if (comment.username === getUsername().value) {
                  hasAlreadyCommented.value = true;
                  break;
                }
              }
            }
            hasLoaded.value = true;
          }
        })
        .catch((error) => {
          console.log(error);
          router.back();
        });

    updateRouteDetails();

    const postCommentHandler = () => {
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
    };

    const deleteCommentHandler = (commentUsername: string, timestamp: number) => {
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
      sendSharp,
      hasLoaded,
    };
  },
});
</script>

<style scoped>
#container {
  position: absolute;
  left: 0;
  right: 0;
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
  border-radius: 4px;
  padding: 2px;
  margin: 0;
}

.center-right:hover {
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
