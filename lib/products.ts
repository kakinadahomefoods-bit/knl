export type Product={id:string;name:string;category:string;price:number;compareAt?:number;description:string;emoji:string;tag?:string};
// Illustrative DEMO items only. Replace with verified, authorized catalogue before launch.
export const products:Product[]=[
{id:'classic-choco-chip',name:'Classic Chocolate Chip Cookies',category:'Cookies',price:299,compareAt:349,description:'A golden, buttery cookie with rich chocolate chips.',emoji:'🍪',tag:'Bestseller'},
{id:'double-chocolate',name:'Double Chocolate Cookies',category:'Cookies',price:329,compareAt:379,description:'Deep cocoa flavor with indulgent chocolate chunks.',emoji:'🍫',tag:'Popular'},
{id:'butter-cookies',name:'Butter Cookies',category:'Cookies',price:269,description:'Delicate, melt-in-your-mouth buttery cookies.',emoji:'🧈'},
{id:'almond-crunch',name:'Almond Crunch Cookies',category:'Cookies',price:349,description:'Crisp cookies with roasted almond notes.',emoji:'🥜'},
{id:'fudge-brownie',name:'Chocolate Fudge Brownie',category:'Brownies',price:249,compareAt:299,description:'Soft-centered chocolate brownie with a rich finish.',emoji:'🍫',tag:'Bestseller'},
{id:'walnut-brownie',name:'Walnut Brownie',category:'Brownies',price:279,description:'Chocolate brownie with crunchy walnut pieces.',emoji:'🍰'},
{id:'cookie-gift-box',name:'Cookie Celebration Box',category:'Gift Boxes',price:799,compareAt:899,description:'A delightful selection of cookies for gifting.',emoji:'🎁',tag:'Gift Pick'},
{id:'sweet-combo',name:'Cookies & Brownies Combo',category:'Gift Boxes',price:999,description:'A shareable assortment of sweet favorites.',emoji:'🎀'}];
export const categories=['All','Cookies'];
