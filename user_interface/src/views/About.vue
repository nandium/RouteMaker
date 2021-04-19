<template>
  <b-jumbotron>
    <h1 class="display-4">Hello Climbers! &#129495;</h1>
    <hr class="my-4" />
    <p class="lead">
      Personally, when people make routes for me at the gym, 
      <br/>
      I tend to forget half of the moves due to my poor memory.
    <p class="lead">
      One way is to draw them out on a handphone,
      <br/>
      but it is difficult to do so with fat fingers, and labeling
      <br/>
      the exact order of moves can be troublesome too.
    </p>
    <p class="lead">
      This application aims to solve this issue.
    </p>
    
    <hr class="my-4" />
    <p class="lead my-4">1. Upload the photo of a climbing wall</p>
    <img class="border border-secondary" src="@/assets/Screenshot_1.jpg" />
    <br/><br/>
    <p class="lead my-4">2. The holds will be marked automatically</p>
    <img class="border border-secondary" src="@/assets/Screenshot_2.jpg" />
    <br/><br/>
    <p class="lead my-4">3. Select your handholds</p>
    <img class="border border-secondary" src="@/assets/Screenshot_3.jpg" />
    <br/><br/>
    <p class="lead my-4">4. Select your footholds</p>
    <img class="border border-secondary" src="@/assets/Screenshot_4.jpg" />
    <br/><br/>
    <p class="lead my-4">5. Export as an image to share with friends</p>
    <img class="border border-secondary" src="@/assets/Screenshot_5.jpg" />
    <br/><br/>

    <hr class="my-4" />
    <p class="lead my-4">Pull requests are welcomed!</p>
    
    <b-button
      size="lg"
      variant="dark"
      class="mx-2"
      href="https://github.com/yarkhinephyo/yolo_bouldering"
      target="_blank"
      role="button"
      ><b-icon-github /> Github</b-button
    >
  </b-jumbotron>
  
</template>
<style scoped>
img {
  border-radius: 1rem;
}
.jumbotron {
  margin-bottom: 0;
}
</style>
