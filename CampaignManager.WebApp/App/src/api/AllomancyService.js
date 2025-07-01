import Api from './Api';
class AllomancyService {
    callbacks = [];

    async GetSnapChart() {
        return Api.fetch(`/api/allomancy/getSnapChart/${email}/${password}`);
    }

    async GetSnap(favoredClass, favoredAbility) {
        return Api.fetch(`/api/allomancy/getSnap/${favoredClass}/${favoredAbility}`);
    }
}

export default new AllomancyService();