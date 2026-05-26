import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

import { CustomSearchComponentComponent } from "../custom-search-component/custom-search-component.component";


@NgModule({
  declarations: [CustomSearchComponentComponent],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    FormsModule
],
  exports: [CustomSearchComponentComponent]
})
export class CustomSearchComponentModule {}
