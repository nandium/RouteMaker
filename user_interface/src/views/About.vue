<template>
  <b-jumbotron>
    <h1 class="display-4">Allez Climbers!</h1>
    <p class="lead">
      Personally, when people make routes for me at the gym, I tend to forget
      half of the moves with my goldfish memory.
    </p>
    <p class="lead">
      One way to solve this is to label out the routes on mobile, but circling
      and numbering them takes too much time too.
    </p>
    <hr class="my-4" />
    <p class="lead my-4">1. Upload the photo of a climbing wall</p>
    <img src="@/assets/Screenshot_1.jpg" />
    <p class="lead my-4">2. Label the holds as handholds or footholds</p>
    <img src="@/assets/Screenshot_2.jpg" />
    <p class="lead my-4">3. Export it to share with friends</p>
    <img src="@/assets/Screenshot_3.jpg" />

    <hr class="my-4" />
    <b-button
      size="lg"
      variant="primary"
      class="mx-2"
      href="https://github.com/yarkhinephyo/yolo_bouldering"
      role="button"
      >Github</b-button
    >
    <b-button
      size="lg"
      variant="primary"
      class="mx-2"
      href="https://www.linkedin.com/in/yar-khine-phyo-93073012b/"
      role="button"
      >Contact</b-button
    >
  </b-jumbotron>
</template>
<style scoped>
img {
  border-radius: 1rem;
}
</style>
