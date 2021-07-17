<template>
  <ion-list class="ion-no-margin ion-no-padding">
    <ion-card
      v-for="(route, index) of routes"
      :key="index"
      class="ion-text-left route-card"
      @click="() => handleRouteCardClick(route.username, route.createdAt)"
    >
      <ion-card-header>
        <ion-card-title>{{ route.routeName }}</ion-card-title>
        <VoteButton
          class="vote-button"
          :username="route.username"
          :createdAt="route.createdAt"
          v-model:voteCount="route.voteCount"
          v-model:hasVoted="route.hasVoted"
        ></VoteButton>
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
    <ion-card v-if="routes.length === 0" class="ion-text-center route-card">
      <ion-card-header>
        <ion-card-title>No Routes Found</ion-card-title>
      </ion-card-header>
    </ion-card>
  </ion-list>
</template>

<script lang="ts">
import { defineComponent, inject, Ref, ref, onMounted } from 'vue';
import { heart, heartOutline } from 'ionicons/icons';
import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonList } from '@ionic/vue';
import { useRouter, useRoute } from 'vue-router';
import axios from 'axios';

import VoteButton from '@/components/VoteButton.vue';
import { throttle } from 'lodash';

interface UserRoute {
  commentCount: number;
  createdAt: string;
  gymLocation: string;
  publicGrade: number;
  routeName: string;
  username: string;
  voteCount: number;
  hasVoted: boolean;
  countryCode: string;
  gymName: string;
}

export default defineComponent({
  name: 'UserRouteList',
  components: {
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    VoteButton,
    IonList,
  },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const { username } = route.params;
    const routes = ref<Array<UserRoute>>([]);
    const getLoggedIn: () => Ref<boolean> = inject('getLoggedIn', () => ref(false));
    const getAccessToken: () => Ref<string> = inject('getAccessToken', () => ref(''));

    const updateRoutes = throttle(() => {
      const headers = getLoggedIn().value
        ? { Authorization: `Bearer ${getAccessToken().value}` }
        : {};
      axios
        .get(process.env.VUE_APP_ROUTE_ENDPOINT_URL + '/route/user', {
          headers,
          params: {
            username,
          },
        })
        .then((response) => {
          if (response.data.Message === 'Query routes by user success') {
            routes.value = response.data.Items;
          } else {
            throw new Error('Failed to get routes');
          }
        })
        .catch((error) => {
          console.error(error);
          throw new Error('Failed to get routes');
        });
    }, 50);

    onMounted(updateRoutes);

    const handleRouteCardClick = (username: string, createdAt: string) => {
      router.push({
        name: 'ViewRoute',
        params: {
          username,
          createdAt,
        },
      });
    };

    return {
      routes,
      handleRouteCardClick,
      heart,
      heartOutline,
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

.vote-button {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
}
</style>
