<template>
  <ion-list>
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
        <b>Creator:</b>
        {{ route.username }}
        <br />
        <b>Grade:</b>
        V{{ route.publicGrade }}
      </ion-card-content>
    </ion-card>
  </ion-list>
</template>

<script lang="ts">
import { defineComponent, inject, Ref, ref, watch } from 'vue';
import { heart, heartOutline } from 'ionicons/icons';
import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonList } from '@ionic/vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

import VoteButton from '@/components/VoteButton.vue';
import { throttle } from 'lodash';

interface Route {
  commentCount: number;
  createdAt: string;
  gymLocation: string;
  publicGrade: number;
  routeName: string;
  username: string;
  voteCount: number;
  hasVoted: boolean;
}

export default defineComponent({
  name: 'RouteList',
  components: {
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    VoteButton,
    IonList,
  },
  setup() {
    const router = useRouter();
    const routes = ref<Array<Route>>([]);
    const getAccessToken: () => Ref<string> = inject('getAccessToken', () => ref(''));

    let gymLocation = '';

    const updateRoutes = throttle(() => {
      if (gymLocation === '') {
        return;
      }
      axios
        .get(process.env.VUE_APP_ROUTE_ENDPOINT_URL + '/route/all', {
          headers: {
            Authorization: `Bearer ${getAccessToken().value}`,
          },
          params: {
            gymLocation,
          },
        })
        .then((response) => {
          console.log(response);
          if (response.data.Message === 'Query routes by gym success') {
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

    const setGymLocation = (location: string) => {
      gymLocation = location;
      updateRoutes();
    };

    // Small hack to ensure that the likes always stay in sync
    watch(router.currentRoute, () => {
      if (router.currentRoute.value.path === '/gyms') {
        updateRoutes();
      }
    });

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
      setGymLocation,
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
