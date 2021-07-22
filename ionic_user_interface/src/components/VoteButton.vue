<template>
  <div
    class="vote-button-component"
    @click.stop.prevent="() => handleVoteClick(username, createdAt)"
  >
    <ion-icon color="danger" :icon="hasVotedRef ? heart : heartOutline"></ion-icon>
    <p>{{ voteCountRef }}</p>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, inject, Ref, ref } from 'vue';
import { heart, heartOutline } from 'ionicons/icons';
import { IonIcon, toastController } from '@ionic/vue';
import axios from 'axios';
import { throttle } from 'lodash';

export default defineComponent({
  name: 'VoteButton',
  components: {
    IonIcon,
  },
  props: {
    username: {
      type: String,
      required: true,
    },
    createdAt: {
      type: String,
      required: true,
    },
    voteCount: {
      type: Number,
      required: true,
    },
    hasVoted: {
      type: Boolean,
      required: true,
    },
  },
  setup(props, { emit }) {
    const getAccessToken: () => Ref<string> = inject('getAccessToken', () => ref(''));
    const getLoggedIn: () => Ref<boolean> = inject('getLoggedIn', () => ref(false));
    const voteCountRef = computed({
      get: () => props.voteCount,
      set: (value) => emit('update:voteCount', value),
    });
    const hasVotedRef = computed({
      get: () => props.hasVoted,
      set: (value) => emit('update:hasVoted', value),
    });

    let waitingForResponse = false;

    const handleVoteClick = throttle((username: string, createdAt: string) => {
      if (!getLoggedIn().value) {
        toastController
          .create({
            header: 'Please log in!',
            position: 'bottom',
            color: 'danger',
            duration: 2000,
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
        return;
      }
      if (waitingForResponse) {
        return;
      }
      // Toggle voteCount and hasVoted
      voteCountRef.value += hasVotedRef.value ? -1 : 1;
      hasVotedRef.value = !hasVotedRef.value;

      waitingForResponse = true;
      axios
        .post(
          process.env.VUE_APP_ROUTE_ENDPOINT_URL + '/v1/route/details/toggleUpvote',
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
          // If different message received, throw error to jump to catch block
          if (response.data.Message !== 'Toggle upvote route success') {
            throw Error(response.data.Message);
          }
        })
        .catch((error) => {
          console.error(error);
          // Toggle back voteCount and hasVoted if voting failed
          voteCountRef.value += hasVotedRef.value ? -1 : 1;
          hasVotedRef.value = !hasVotedRef.value;
        })
        .finally(() => {
          waitingForResponse = false;
        });
    }, 500);

    return {
      heart,
      heartOutline,
      handleVoteClick,
      voteCountRef,
      hasVotedRef,
    };
  },
});
</script>

<style scoped lang="scss">
.vote-button-component {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  border-radius: 10px;
  border: 2px solid var(--ion-color-danger);
  padding: 5px 7px;
  align-self: center;

  &:hover {
    cursor: pointer;
    background-color: rgba(var(--ion-color-danger-rgb), 0.12);
  }

  p {
    align-self: center;
    margin: 0 auto;
    color: var(--ion-color-danger);
  }
}
</style>
