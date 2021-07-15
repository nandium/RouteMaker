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
        <b>Grade:</b>
        V{{ route.publicGrade }}
        <br />
        <b>Gym:</b>
        {{ route.gymName }}
        <br />
        <b>Created:</b>
        {{ route.createdAt.split('T')[0] }}
      </ion-card-content>
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

interface Route {
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
    const routes = ref<Array<Route>>([]);
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
          console.log(response);
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
