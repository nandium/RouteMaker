<template>
  <div>
    <ion-item>
      <ion-input
        type="text"
        placeholder="Search for a route"
        v-model="searchText"
        maxlength="70"
        clear-input
      ></ion-input>
      <ion-icon :icon="searchOutline" slot="end"></ion-icon>
    </ion-item>
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
import {
  heart,
  heartOutline,
  filterOutline,
  checkmarkOutline,
  searchOutline,
} from 'ionicons/icons';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonInput,
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
  routeId: number;
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
    IonInput,
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

    const searchText = ref('');
    const searchMap = new Map();
    let freqMap = new Map();
    let gradeBounds = { lower: 0, upper: 14 };

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
            // Add a unique index to each route
            response.data.Items.forEach((element: Route, index: number) => {
              element.routeId = index;
            });
            routes = response.data.Items;
            filteredSortedRoutes.value = response.data.Items;
            // Map search queries to route ID
            for (const route of routes) {
              const routeName = route.routeName.toLowerCase();
              if (searchMap.has(routeName)) {
                searchMap.get(routeName).push(route.routeId);
              } else {
                searchMap.set(routeName, [route.routeId]);
              }
              const username = route.username.toLowerCase();
              if (searchMap.has(username)) {
                searchMap.get(username).push(route.routeId);
              } else {
                searchMap.set(username, [route.routeId]);
              }
              const vGrade = 'v' + route.publicGrade.toString();
              if (searchMap.has(vGrade)) {
                searchMap.get(vGrade).push(route.routeId);
              } else {
                searchMap.set(vGrade, [route.routeId]);
              }
              const createdAt = route.createdAt.toLowerCase().substring(0, 10);
              if (searchMap.has(createdAt)) {
                searchMap.get(createdAt).push(route.routeId);
              } else {
                searchMap.set(createdAt, [route.routeId]);
              }
            }
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

    watch(
      searchText,
      throttle(() => {
        const queryString = searchText.value.trim().toLowerCase();
        if (queryString.length === 0) {
          // Query has been cleared, set back to normal filtering and sorting
          filteredSortedRoutes.value = routes;
          filterRoutes(routes);
          sortRoutes();
          return;
        }
        if (queryString.length > 70) {
          return;
        }
        const queryArray = queryString.split(' ');
        // Create a frequency map based on the queryArray
        freqMap = new Map();
        for (const [key, ids] of searchMap) {
          for (const queryString of queryArray) {
            if (key.includes(queryString)) {
              for (const id of ids) {
                if (freqMap.has(id)) {
                  freqMap.set(id, freqMap.get(id) + 1);
                } else {
                  freqMap.set(id, 1);
                }
              }
            }
          }
        }
        // Sort array by entries (highest frequency first)
        freqMap[Symbol.iterator] = function* () {
          yield* [...this.entries()].sort((a, b) => b[1] - a[1]);
        };
        searchRoutes();
      }, 700),
    );

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

    const filterRoutes = (routesToFilter: Array<Route>) => {
      filteredSortedRoutes.value = routesToFilter.filter(
        (route) => route.publicGrade >= gradeBounds.lower && route.publicGrade <= gradeBounds.upper,
      );
    };

    const searchRoutes = () => {
      const newFilteredSortedRoutes: Array<Route> = [];
      // eslint-disable-next-line
      for (const [id, _] of freqMap) {
        newFilteredSortedRoutes.push(routes[id]);
      }
      filteredSortedRoutes.value = newFilteredSortedRoutes;
      filterRoutes(filteredSortedRoutes.value);
    };

    const filterGradeHandler = (event: CustomEvent<RangeChangeEventDetail>) => {
      gradeBounds = event.detail.value as {
        lower: number;
        upper: number;
      };
      filterRoutes(routes);
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
      searchOutline,
      searchText,
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
