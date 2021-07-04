<template>
  <ion-list>
    <ion-card
      v-for="({ routeName, username, createdAt, publicGrade, voteCount }, index) in routes"
      :key="index"
      class="ion-text-left route-card"
      @click="() => handleRouteCardClick(username, createdAt)"
    >
      <ion-card-header>
        <ion-card-title>{{ routeName }}</ion-card-title>
        <div class="center-right">
          <ion-icon :icon="heart"></ion-icon>
          <p>{{ voteCount }}</p>
        </div>
      </ion-card-header>
      <ion-card-content>
        <b>Creator:</b>
        {{ username }}
        <br />
        <b>Grade:</b>
        V{{ publicGrade }}
      </ion-card-content>
    </ion-card>
  </ion-list>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { heart } from 'ionicons/icons';
import { IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon, IonList } from '@ionic/vue';
import { useRouter } from 'vue-router';
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
    IonIcon,
    IonList,
  },
  setup() {
    const router = useRouter();
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
  right: 10px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  border-radius: 10px;
  border: 2px solid grey;
  padding: 0 7px;
}

p {
  padding: 0;
  line-height: 22px;
  margin: 0;
}
</style>
