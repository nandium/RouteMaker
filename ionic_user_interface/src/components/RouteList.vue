<template>
  <ion-list>
    <ion-card
      v-for="({ routeName, username, createdAt }, index) in routes"
      :key="index"
      class="ion-text-left route-card"
      @click="() => handleRouteCardClick(username, createdAt)"
    >
      <ion-card-header>
        <ion-card-title>{{ routeName }}</ion-card-title>
      </ion-card-header>
      <ion-card-content>
        {{ username }}
      </ion-card-content>
    </ion-card>
  </ion-list>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonList } from '@ionic/vue';
import axios from 'axios';

interface Route {
  commentCount: number;
  createdAt: string;
  gymLocation: string;
  publicGrade: number;
  routeName: string;
  username: string;
  voteCount: number;
}

export default defineComponent({
  name: 'RouteList',
  components: {
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonList,
  },
  setup() {
    const routes = ref<Array<Route>>([]);

    const setGymLocation = (gymLocation: string) => {
      axios
        .get(process.env.VUE_APP_ROUTE_ENDPOINT_URL + '/route/all', {
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
    };

    const handleRouteCardClick = (username: string, createdAt: string) => {
      console.log(username + '  ' + createdAt);
    };

    return {
      routes,
      setGymLocation,
      handleRouteCardClick,
    };
  },
});
</script>

<style scoped>
.route-card:hover {
  cursor: pointer;
  filter: brightness(120%);
}
</style>
