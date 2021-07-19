<template>
  <div>
    <div class="ion-margin-start ion-margin-bottom">
      <ion-text>
        Posts:
        <strong>{{ routes.length }}</strong>
      </ion-text>
      <br />
      <ion-text>
        Upvotes:
        <strong>{{ totalUserUpvotes }}</strong>
      </ion-text>
    </div>
    <ion-list class="ion-no-margin ion-no-padding">
      <ion-card
        v-for="(route, index) of routes"
        :key="index"
        class="ion-text-left route-card"
        @click="() => handleRouteCardClick(route.username, route.createdAt)"
      >
        <ion-card-header>
          <ion-card-title>{{ route.routeName }}</ion-card-title>
          <div class="center-right">
            <div
              v-if="isOwnself || isAdmin"
              class="delete-button"
              @click.stop.prevent="
                () => deleteRouteHandler(route.routeName, route.username, route.createdAt)
              "
            >
              <ion-icon :icon="trashOutline"></ion-icon>
            </div>
            <VoteButton
              :username="route.username"
              :createdAt="route.createdAt"
              v-model:voteCount="route.voteCount"
              v-model:hasVoted="route.hasVoted"
            ></VoteButton>
          </div>
        </ion-card-header>
        <ion-card-content>
          <b>Gym:&nbsp;</b>
          <router-link
            :to="'/gym/' + route.gymLocation + '/' + route.gymName"
            @click.capture.stop="() => undefined"
          >
            {{ route.gymName }}
          </router-link>
          <br />
          <b>Grade:</b>
          V{{ route.publicGrade }}
          <br />
          <b>Created:</b>
          {{ route.createdAt.split('T')[0] }}
        </ion-card-content>
      </ion-card>
      <ion-card v-if="routes.length === 0" class="ion-text-center">
        <ion-card-header>
          <ion-spinner v-if="isLoading" name="crescent"></ion-spinner>
          <ion-card-title v-if="!isLoading">No Routes Found</ion-card-title>
        </ion-card-header>
      </ion-card>
    </ion-list>
  </div>
</template>

<script lang="ts">
import { defineComponent, inject, Ref, ref, onMounted, computed, ComputedRef, watch } from 'vue';
import { heart, heartOutline, trashOutline } from 'ionicons/icons';
import {
  alertController,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonList,
  IonSpinner,
  IonText,
} from '@ionic/vue';
import { useRouter, useRoute } from 'vue-router';
import axios from 'axios';
import { throttle } from 'lodash';

import VoteButton from '@/components/VoteButton.vue';
import getRoutesByUser, { UserRoute } from '@/common/api/route/getRoutesByUser';

export default defineComponent({
  name: 'UserRouteList',
  components: {
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonIcon,
    IonList,
    IonSpinner,
    IonText,
    VoteButton,
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const routes = ref<UserRoute[]>([]);
    const getAccessToken: () => Ref<string> = inject('getAccessToken', () => ref(''));
    const getUserRole: () => ComputedRef<string> = inject('getUserRole', () => computed(() => ''));
    const getUsername: () => Ref<string> = inject('getUsername', () => ref(''));
    const profileUsername = computed(() => route.params.username as string);
    const isOwnself = computed(() => profileUsername.value === getUsername().value);
    const isAdmin = computed(() => getUserRole().value === 'admin');
    const totalUserUpvotes = computed(() =>
      routes.value.reduce((acc, curr) => acc + curr.voteCount, 0),
    );

    const isLoading = ref(false);

    const updateRoutes = throttle(async () => {
      routes.value = [];
      isLoading.value = true;

      try {
        const data = await getRoutesByUser(profileUsername.value);
        if (data.Message === 'Query routes by user success') {
          routes.value = data.Items;
        } else {
          throw new Error('Failed to get routes');
        }
      } catch (error) {
        console.error(error);
        throw new Error('Failed to get routes');
      } finally {
        isLoading.value = false;
      }
    }, 1000);

    onMounted(updateRoutes);

    watch(profileUsername, updateRoutes);

    const handleRouteCardClick = (username: string, createdAt: string) => {
      router.push({
        name: 'ViewRoute',
        params: {
          username,
          createdAt,
        },
      });
    };

    const deleteRouteHandler = throttle(
      async (routeName: string, username: string, createdAt: string) => {
        const alert = await alertController.create({
          header: `Delete route '${routeName}'?`,
          message:
            'This action cannot be undone. <br/><br/> Once the route is deleted, you will not be able to restore it.',
          buttons: [
            {
              text: 'Cancel',
              role: 'cancel',
            },
            {
              text: 'Delete',
              cssClass: 'danger-text',
              handler: throttle(async () => {
                await axios
                  .delete(process.env.VUE_APP_ROUTE_ENDPOINT_URL + '/route', {
                    headers: {
                      Authorization: `Bearer ${getAccessToken().value}`,
                    },
                    params: {
                      username,
                      createdAt,
                    },
                  })
                  .then(() => {
                    updateRoutes();
                  })
                  .catch((error) => {
                    console.error(error);
                  });
              }, 1000),
            },
          ],
        });
        return alert.present();
      },
      1000,
    );

    return {
      routes,
      totalUserUpvotes,
      handleRouteCardClick,
      deleteRouteHandler,
      heart,
      heartOutline,
      isAdmin,
      trashOutline,
      isOwnself,
      isLoading,
    };
  },
});
</script>

<style scoped>
.route-card:hover {
  cursor: pointer;
  filter: brightness(120%);
}

ion-card-header {
  position: relative;
}

.center-right {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 25px;
  margin: 0;
}

.delete-button {
  border: 2px solid grey;
  border-radius: 10px;
  margin-right: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 35px;
  height: 35px;
}

.delete-button:hover {
  background-color: #333333;
  cursor: pointer;
}

ion-spinner {
  height: 60px;
  width: 60px;
}
</style>
