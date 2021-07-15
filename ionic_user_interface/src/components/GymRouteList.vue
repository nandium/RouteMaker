<template>
  <div>
    <ion-item class="button-row">
      <div class="range">
        <ion-range
          class="grade-slider ion-margin"
          min="0"
          max="14"
          step="1"
          snaps
          color="danger"
          :value="{ lower: 0, upper: 14 }"
          dual-knobs
          @ionChange="filterGradeHandler"
          debounce="100"
        ></ion-range>
        <div class="sliderticks">
          <p v-for="index of range(0, 14)" :key="index">V{{ index }}</p>
        </div>
      </div>
      <ion-button
        expand="full"
        color="light"
        slot="end"
        class="ion-no-margin"
        @click="setPopoverOpen(true, $event)"
      >
        <ion-label>Sort</ion-label>
        <ion-icon :icon="filterOutline"></ion-icon>
      </ion-button>
    </ion-item>
    <ion-popover
      :is-open="isPopoverOpen"
      :translucent="true"
      :event="popoverEvent"
      keyboard-close
      @didDismiss="setPopoverOpen(false)"
    >
      <ion-list class="no-padding no-margin">
        <ion-item button @click="setSortMode(SortMode.NEWEST)">
          Newest
          <ion-icon
            slot="end"
            :icon="checkmarkOutline"
            v-if="sortMode === SortMode.NEWEST"
          ></ion-icon>
        </ion-item>
        <ion-item button @click="setSortMode(SortMode.OLDEST)">
          Oldest
          <ion-icon
            slot="end"
            :icon="checkmarkOutline"
            v-if="sortMode === SortMode.OLDEST"
          ></ion-icon>
        </ion-item>
        <ion-item button @click="setSortMode(SortMode.VOTES)">
          Most votes
          <ion-icon
            slot="end"
            :icon="checkmarkOutline"
            v-if="sortMode === SortMode.VOTES"
          ></ion-icon>
        </ion-item>
        <ion-item button @click="setSortMode(SortMode.EASIEST)">
          Easiest
          <ion-icon
            slot="end"
            :icon="checkmarkOutline"
            v-if="sortMode === SortMode.EASIEST"
          ></ion-icon>
        </ion-item>
        <ion-item button @click="setSortMode(SortMode.HARDEST)">
          Hardest
          <ion-icon
            slot="end"
            :icon="checkmarkOutline"
            v-if="sortMode === SortMode.HARDEST"
          ></ion-icon>
        </ion-item>
      </ion-list>
    </ion-popover>
    <ion-list class="ion-no-margin ion-no-padding">
      <ion-card
        v-for="(route, index) of filteredSortedRoutes"
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
  </div>
</template>

<script lang="ts">
import { defineComponent, inject, Ref, ref, watch } from 'vue';
import { RangeChangeEventDetail } from '@ionic/core/dist/types/interface';
import { heart, heartOutline, filterOutline, checkmarkOutline } from 'ionicons/icons';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPopover,
  IonRange,
} from '@ionic/vue';
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

enum SortMode {
  VOTES,
  EASIEST,
  HARDEST,
  OLDEST,
  NEWEST,
}

export default defineComponent({
  name: 'GymRouteList',
  components: {
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonPopover,
    IonRange,
    VoteButton,
  },
  setup() {
    const router = useRouter();
    let routes: Array<Route> = [];
    const filteredSortedRoutes = ref<Array<Route>>([]);
    const getLoggedIn: () => Ref<boolean> = inject('getLoggedIn', () => ref(false));
    const getAccessToken: () => Ref<string> = inject('getAccessToken', () => ref(''));

    const sortMode = ref(SortMode.NEWEST);

    const popoverEvent = ref();
    const isPopoverOpen = ref(false);

    let gymLocation = '';

    const range = (start: number, end: number) => {
      return Array.from({ length: end - start + 1 }, (_, i) => i);
    };

    const updateRoutes = throttle(() => {
      if (gymLocation === '') {
        return;
      }
      const headers = getLoggedIn().value
        ? { Authorization: `Bearer ${getAccessToken().value}` }
        : {};
      axios
        .get(process.env.VUE_APP_ROUTE_ENDPOINT_URL + '/route/all', {
          headers,
          params: {
            gymLocation,
          },
        })
        .then((response) => {
          if (response.data.Message === 'Query routes by gym success') {
            routes = response.data.Items;
            console.log(routes);
            filteredSortedRoutes.value = response.data.Items;
          } else {
            throw new Error('Failed to get routes');
          }
        })
        .catch((error) => {
          console.error(error);
          throw new Error('Failed to get routes');
        });
    }, 50);

    const setPopoverOpen = (state: boolean, event?: Event) => {
      popoverEvent.value = event;
      isPopoverOpen.value = state;
    };

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

    const sortRoutes = () => {
      switch (sortMode.value) {
        case SortMode.VOTES:
          filteredSortedRoutes.value.sort((route1, route2) => route2.voteCount - route1.voteCount);
          break;
        case SortMode.EASIEST:
          filteredSortedRoutes.value.sort(
            (route1, route2) => route1.publicGrade - route2.publicGrade,
          );
          break;
        case SortMode.HARDEST:
          filteredSortedRoutes.value.sort(
            (route1, route2) => route2.publicGrade - route1.publicGrade,
          );
          break;
        case SortMode.NEWEST:
          filteredSortedRoutes.value.sort((route1, route2) => {
            const date1 = new Date(route1.createdAt);
            const date2 = new Date(route2.createdAt);
            if (date1 < date2) {
              return 1;
            } else if (date1 > date2) {
              return -1;
            } else {
              return 0;
            }
          });
          break;
        case SortMode.OLDEST:
          filteredSortedRoutes.value.sort((route1, route2) => {
            const date1 = new Date(route1.createdAt);
            const date2 = new Date(route2.createdAt);
            if (date1 < date2) {
              return -1;
            } else if (date1 > date2) {
              return 1;
            } else {
              return 0;
            }
          });
          break;
        default:
          break;
      }
    };

    const filterGradeHandler = (event: CustomEvent<RangeChangeEventDetail>) => {
      const { lower: gradeLowerBound, upper: gradeUpperBound } = event.detail.value as {
        lower: number;
        upper: number;
      };
      filteredSortedRoutes.value = routes.filter(
        (route) => route.publicGrade >= gradeLowerBound && route.publicGrade <= gradeUpperBound,
      );
      sortRoutes();
    };

    const setSortMode = throttle((mode: SortMode) => {
      sortMode.value = mode;
      setPopoverOpen(false);
      sortRoutes();
    }, 500);

    return {
      range,
      setGymLocation,
      handleRouteCardClick,
      heart,
      heartOutline,
      filterOutline,
      checkmarkOutline,
      setPopoverOpen,
      popoverEvent,
      isPopoverOpen,
      sortMode,
      setSortMode,
      SortMode,
      filterGradeHandler,
      filteredSortedRoutes,
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

.button-row {
  --min-height: 45px;
}

.range {
  flex: 1;
  padding: 10px;
  margin: 0 1vmin 0 0.5vmin;
}

.grade-slider {
  margin: 0;
  padding: 0;
}

.sliderticks {
  display: flex;
  justify-content: space-between;
  padding: 0 0;
  margin-top: -10px;
}

.sliderticks p {
  font-size: 2.3vmin;
  position: relative;
  display: flex;
  justify-content: center;
  text-align: center;
  width: 1px;
  background: #d3d3d3;
  height: 1vmin;
  line-height: 5vmin;
  margin: 0 0 20px 0;
}

.vote-button {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
}
</style>
