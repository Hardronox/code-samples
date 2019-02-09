import React, {Component} from 'react';
import {withRouter} from "react-router";
import {toast} from "react-toastify";
import {DateUtils} from 'react-day-picker';

import {propTypes, defaultProps} from './types';
import {connected} from './connect';
import {Container, FilterPaneContainer} from './styled';

import {FilterPane} from "./components/FilterPane/index";
import ResultsContainer from "./components/Results/ResultsContainer";
import TruckDetailsContainer from "./components/TruckDetails/TruckDetailsContainer";
import {
  StateFieldDimensionForkLength,
  StateFieldDimensionLiftHeight,
  StateFieldDimensionOverallHeight,
  StateFieldDimensionWidth,
  StateFieldNameBrands,
  StateFieldNameModels, StateFieldNameRentalDates, StateFieldNameRentalDatesFrom, StateFieldNameRentalDatesTo,
  StateFieldNameTruckQuantity,
  StateFieldNameTruckType,
} from "./constants";
import {
  getMessageTruckCountInCartSuccess,
  MessageExceededCurrentTruckTypeInCart, MessageNotValidDateRange,
} from "./messages";
import {getParsedProductResponse} from "./helpers/parseProductData";
import {getParsedFilterResponse} from "./helpers/parseFilterData";
import posed from 'react-pose';
import {
  getTruckTypesCollectionToChoose,
  getTruckTypesDataToReducerFormat
} from "../../helpers/truck_types";
import {
  createOptionsForTruckTypeFromURL,
} from "./helpers/url_params";
import {stateFieldNameToDropDownParams} from "./settings/dropdown_params";
import {
  formatRentalDateToSend, getRentalDateEndDefault, getRentalDateStartDefault,
  isDatesRangeValid
} from "./helpers/date";
import {
  getMandatoryParams,
  getQueryAfterResetField,
  getRequestQuery,
  getResetParams,
  getTruckDetailsParams,
  getUpdatedQuery
} from "./helpers/query_params";
import {formatDropDownDataToStateData, isDropDownValuesEqual} from "./helpers/optionsDropDown";
import {
  getCurrentQuantity,
  getCurrentTruckTypeId,
  getCurrentTruckTypeNameToDisplay,
  getRealQuantityByTruckTypeId,
  getTruckTypeNamesToDisplay
} from "./helpers/selectors";
import {ModalCartInfo} from "./components/ModalCartInfo/index";
import {BottomTextModalCartInfo, SuccessMessageModalCartInfo} from "./helpers/components";
import {CartService} from "../../../../servises/CartService";
import {stateFieldNameToQueryParam} from "./settings/query_params";
import {checkDimensionValidity} from "./helpers/validation";
import {getFilteredEnergyTypesVariantsToStateFormat} from "./helpers/filters";
import {
  getSelectedTruckTypesFromURL,
  getUpdatedTruckTypesParamsStringForURL,
} from "../../helpers/url_params";
import {FormattedMessage} from "react-intl";


const PanelsContainer = posed.div({
  filter: {
    x: 0,
    transition: { duration: 500 }
    },
  detailsPanel: {
    x: "-47%",
    transition: { duration: 500 }
    },
});


class FilterPageBase extends Component {

  state = {
    isInitDataSet: false,
    filterResponse: null,
    position: false,
    modalVisibilityProductCartCompleted: false,

    truckType: null,
    truckQuantity: stateFieldNameToDropDownParams[StateFieldNameTruckQuantity].defaultValue,
    rentalDates: {
      from: '',
      to: '',
    },
    isRangeDayPickerOpen: {
      from: false,
      to: false,
    },
    weightCapacityInitialMin: 0,
    weightCapacityInitialMax: 0,
    weightCapacity: {
      min: 0,
      max: 0,
    },
    engineTypes: {},
    brands: stateFieldNameToDropDownParams[StateFieldNameBrands].defaultValue,
    models: null,
    forkLengthDimension: "",
    widthDimension: "",
    liftLengthDimension: "",
    overallHeightDimension: "",
    query: {},
  };

  componentDidMount() {
    this.setSelectedTruckTypesToCart();
    this.setInitialData();
  };

  componentDidUpdate = (prevProps, prevState) => {
    this.setParsedFilterInitResponse(prevProps, prevState);
    this.setUpdatedInitialData(prevProps, prevState);
    this.showFilterTrucksDataError(prevProps, prevState);
    this.showFilterInitDataError(prevProps, prevState);
    this.setSelectedTruckTypesToCart();
    this.showModalProductCartCompleted(prevProps, prevState);
  };

  /**---------- Component's life cycles helpers START ----------**/
  setParsedFilterInitResponse = (prevProps, prevState) => {
    if(!prevState.isInitDataSet
      && !this.state.isInitDataSet
      && this.props.filterOptionsData.data
      && this.props.product_types
    ) {
      const filterResponse = getParsedFilterResponse(this.props.filterOptionsData, this.props.product_types);
      this.setState((prevState) => {
        return {
          isInitDataSet: true,
          filterResponse,
        };
      });
    }
  };

  showFilterTrucksDataError = (prevProps, prevState) => {
    if (prevProps.filterTrucksData.isLoading
      && !this.props.filterTrucksData.isSuccess
      && this.props.filterTrucksData.error) {
      toast.error(this.props.filterTrucksData.error);
    }
  };

  showFilterInitDataError = (prevProps, prevState) => {
    if (prevProps.filterOptionsData.isLoading
      && !this.props.filterOptionsData.isSuccess
      && this.props.filterOptionsData.error) {
      toast.error(this.props.filterOptionsData.error);
    }
  };

  showModalProductCartCompleted = (prevProps, prevState) => {
    const currentTruckTypeId = getCurrentTruckTypeId(this.state);
    if (currentTruckTypeId &&  this.props.truckTypeToCompleted[currentTruckTypeId] === true
      && prevProps.truckTypeToCompleted[currentTruckTypeId] === false) {
      this.handleModalProductCartCompleted();
    }
  };

  setInitialData = async () => {

    const rentalDates = {
      from: getRentalDateStartDefault(),
      to: getRentalDateEndDefault(),
    };

    const initialStateData = {
      rentalDates,
    };

    await this.setState((prevState) => {
      return {
        ...initialStateData,
      };
    });
    // await this.sendQuery();
  };

  setUpdatedInitialData = async (prevProps, prevState) => {
    if (!prevState.isInitDataSet && this.state.isInitDataSet) {
      const {filterResponse: {filterData}} = this.state;

      let truckTypeMap = null;
      let weightCapacityInitialMin = 0;
      let weightCapacityInitialMax = 0;
      let weightCapacity = {min: weightCapacityInitialMin, max: weightCapacityInitialMax};
      let engineTypes = {};

      if (filterData) {
        truckTypeMap = filterData.product_type_map;
        weightCapacityInitialMin = filterData.capacity_range.min_capacity;
        weightCapacityInitialMax = filterData.capacity_range.max_capacity;
        weightCapacity = {min: weightCapacityInitialMin, max: weightCapacityInitialMax};
        engineTypes = getFilteredEnergyTypesVariantsToStateFormat(filterData.energy_types_variants);
      }

      // Get params from URL
      const truckType = createOptionsForTruckTypeFromURL(this.props.location.search, truckTypeMap);
      const initialStateData = {
        weightCapacity,
        truckType,
        weightCapacityInitialMin,
        weightCapacityInitialMax,
        engineTypes,
      };

      await this.setState((prevState) => {
        const mandatoryParamsForQuery = getMandatoryParams({...prevState, ...initialStateData});
        return {
          ...initialStateData,
          query: {...prevState.query, ...mandatoryParamsForQuery},
        };
      });
      this.sendQuery();
    }
  };

  setSelectedTruckTypesToCart = () => {
    // Set selected types to redux if there are any
    if (!this.props.location || !this.props.location.search) {
      return;
    }
    const selectedTypes = getSelectedTruckTypesFromURL(this.props.location.search);
    const currentQuantity = getCurrentQuantity(this.state);
    const defaultDesiredQuantity = currentQuantity ? currentQuantity : 1;

    if (!this.props.isTruckTypesInitiated) {
      const cartTruckTypesPayload = getTruckTypesDataToReducerFormat(selectedTypes, defaultDesiredQuantity);
      if (!cartTruckTypesPayload) {
        return;
      }
      this.props.setTruckTypesToCartAction(cartTruckTypesPayload);
    }
  };
  /**---------- Component's life cycles helpers END ----------**/

  /**---------- Component's State Handlers START ----------**/
  selectTruck = (serialNumber) => {
    const queryParams = getTruckDetailsParams(this.state);
    let queryParamsString = '';

    if (queryParams) {
      queryParamsString = getRequestQuery(queryParams);

      this.props.getTruckDetails({serialNumber, queryParams: queryParamsString});
    }

    this.setState({ position: true });
  };

  goBackToFilters = () => {
    this.setState({ position: false });
  };

  handleDropDownFilter = (fieldName, shouldSendQuery = true) => async (valueData) => {
    if (!fieldName || !this.state.hasOwnProperty([fieldName])) {
      return;
    }

    const newFieldState = formatDropDownDataToStateData(valueData);
    const updatedQuery = getUpdatedQuery(fieldName, this.state.query, newFieldState);

    if (isDropDownValuesEqual(newFieldState, this.state[fieldName])) {
      return;
    }

    try {
      await this.setState((prevState) => {
        return {
          [fieldName]: newFieldState,
          query: updatedQuery,
        };
      });

      const currentTruckTypeId = getCurrentTruckTypeId(this.state);
      const currentQuantity = getCurrentQuantity(this.state);

      if (fieldName === StateFieldNameTruckType) {
        if(!this.props.truckTypeToCountData[currentTruckTypeId]) {
          this.setURLParamTruckTypes({truckType: currentTruckTypeId});
          const cartTruckTypesPayload = getTruckTypesDataToReducerFormat([currentTruckTypeId], currentQuantity);
          if (!cartTruckTypesPayload) {
            return;
          }
          this.props.setTruckTypesToCartAction(cartTruckTypesPayload);
        }
      }

      if (fieldName === StateFieldNameTruckQuantity && this.state[StateFieldNameTruckType][0]) {

        await this.props.setDesiredQuantityTruckTypeAction({
          truckTypeId: currentTruckTypeId,
          quantity: newFieldState[0].value
        });

        if (this.props.truckTypeToExceeded[currentTruckTypeId] === true) {
          toast.error(MessageExceededCurrentTruckTypeInCart);
        }
      }

      if (shouldSendQuery) {
        this.sendQuery();
      }

    } catch(error) {
      throw new Error(`handleDropDownFilter ${error.message}`);
    }
  };

  handleTruckTypeDropDownFilter = async (valueData) => {
    if (!this.state.hasOwnProperty([StateFieldNameTruckType])) {
      return;
    }

    const newFieldState = formatDropDownDataToStateData(valueData);
    const updatedQuery = getUpdatedQuery(StateFieldNameTruckType, this.state.query, newFieldState);

    if (isDropDownValuesEqual(newFieldState, this.state[StateFieldNameTruckType])) {
      return;
    }

    delete updatedQuery[stateFieldNameToQueryParam[StateFieldDimensionForkLength]];
    delete updatedQuery[stateFieldNameToQueryParam[StateFieldDimensionWidth]];
    delete updatedQuery[stateFieldNameToQueryParam[StateFieldDimensionLiftHeight]];
    delete updatedQuery[stateFieldNameToQueryParam[StateFieldDimensionOverallHeight]];

    try {
      await this.setState((prevState) => {
        return {
          [StateFieldNameTruckType]: newFieldState,
          query: updatedQuery,
          [StateFieldDimensionForkLength]: "",
          [StateFieldDimensionWidth]: "",
          [StateFieldDimensionLiftHeight]: "",
          [StateFieldDimensionOverallHeight]: "",
        };
      });

      const currentTruckTypeId = getCurrentTruckTypeId(this.state);
      const currentQuantity = getCurrentQuantity(this.state);

      if(!this.props.truckTypeToCountData[currentTruckTypeId]) {
        this.setURLParamTruckTypes({truckType: currentTruckTypeId});
        const cartTruckTypesPayload = getTruckTypesDataToReducerFormat([currentTruckTypeId], currentQuantity);
        if (!cartTruckTypesPayload) {
          return;
        }
        this.props.setTruckTypesToCartAction(cartTruckTypesPayload);
      }

      this.sendQuery();

    } catch(error) {
      throw new Error(`handleTruckTypeDropDownFilter ${error.message}`);
    }
  };

  handleBrandsDropDownFilter = async (valueData) => {
    if (!this.state.hasOwnProperty([StateFieldNameBrands]) || !this.state.hasOwnProperty([StateFieldNameModels])) {
      return;
    }

    try {
      const newFieldStateBrands = formatDropDownDataToStateData(valueData);
      const updatedQuery = getUpdatedQuery(StateFieldNameBrands, this.state.query, newFieldStateBrands);
      const activeQuery = getQueryAfterResetField(StateFieldNameModels, updatedQuery);

      if (isDropDownValuesEqual(newFieldStateBrands, this.state[StateFieldNameBrands])) {
        return;
      }

      await this.setState((prevState) => {
        return {
          [StateFieldNameBrands]: newFieldStateBrands,
          [StateFieldNameModels]: null,
          query: activeQuery,
        };
      });
      this.sendQuery();
    } catch(error) {
      throw new Error(`handleBrandsDropDownFilter ${error.message}`);
    }
  };

  handleInputDateChange = async (fieldName, newDate) => {
    if (!fieldName || !this.state.rentalDates.hasOwnProperty([fieldName])) {
      return;
    }
    try {
      await this.setState((prevState) => {
        const newFieldState = {...prevState.rentalDates, [fieldName]: newDate};
        const updatedQuery = getUpdatedQuery(fieldName, this.state.query, newFieldState);
        return {
          rentalDates: newFieldState,
          query: updatedQuery,
        };
      });
      this.sendQuery();
    } catch(error) {
      throw new Error(`handleInputDateChange error: ${error.message}`);
    }
  };

  handleDimensionFilter = (fieldName, shouldSendQuery = true) => async (event) => {
    const value = event.target.value;
    const valueFormatted = Number(value);

    if (!fieldName || !this.state.hasOwnProperty([fieldName]) || checkDimensionValidity(valueFormatted) === false) {
      return;
    }
    try {
      await this.setState((prevState) => {
        const newFieldState = {...prevState, [fieldName]: value};
        const updatedQuery = getUpdatedQuery(fieldName, this.state.query, valueFormatted);
        if (!value) {
          delete updatedQuery[stateFieldNameToQueryParam[fieldName]];
        }
        return {
          ...newFieldState,
          query: updatedQuery,
        };
      });
      this.sendQuery();
    } catch(error) {
      throw new Error(`handleDimensionFilter error: ${error.message}`);
    }
  };

  handleRangeDayPickerShowing = (rentalDateName) => () => {

    if (!rentalDateName || !this.state.isRangeDayPickerOpen.hasOwnProperty([rentalDateName])) {
      return;
    }

    this.setState((prevState) => {
      return {
        isRangeDayPickerOpen: {
          from: false,
          to: false,
          [rentalDateName]: !prevState.isRangeDayPickerOpen[rentalDateName],
        },
      };
    });
  };

  handleDateFilter = (fieldName) => async (valueData) => {
    if (!fieldName || !this.state.rentalDates.hasOwnProperty([fieldName])) {
      return;
    }
    // If range should be used
    // const range = DateUtils.addDayToRange(valueData, this.state.rentalDates);
    const newFieldState = { ...this.state.rentalDates, [fieldName]: valueData};
    const isValid = isDatesRangeValid(newFieldState[StateFieldNameRentalDatesFrom],
                                      newFieldState[StateFieldNameRentalDatesTo]);
    if (!isValid) {
      toast.error(MessageNotValidDateRange);
      return;
    }

    try {
      await this.setState((prevState) => {
        const updatedQuery = getUpdatedQuery(StateFieldNameRentalDates, this.state.query, newFieldState);
        return {
          rentalDates: newFieldState,
          isRangeDayPickerOpen: {
            from: false,
            to: false,
          },
          query: updatedQuery,
        };
      });
      this.sendQuery();
    } catch(error) {
      throw new Error(`handleDateFilter error: ${error.message}`);
    }
  };

  handleRangeFilter = async (fieldName, {min, max}) => {
    if (!fieldName || !this.state.hasOwnProperty([fieldName])) {
      return;
    }

    if (this.props.weightCapacityInitialMin === min && this.props.weightCapacityInitialMax === max) {
      // Reset query param
      this.resetRangeFilter(fieldName);
      return;
    }

    try {
      await this.setState((prevState) => {
        const newFieldState = {min, max};
        const updatedQuery = getUpdatedQuery(fieldName, this.state.query, newFieldState);
        return {
          [fieldName]: newFieldState,
          query: updatedQuery,
        };
      });
      // Query is sent in handleAfterChangeRangeFilter
    } catch(error) {
      throw new Error(`handleRangeFilter ${error.message}`);
    }
  };

  handleAfterChangeRangeFilter = () => {
    this.sendQuery();
  };

  resetRangeFilter = async (fieldName) => {
    const activeQuery = getQueryAfterResetField(fieldName, this.state.query);
    await this.setState((prevState) => {
      return {
        query: activeQuery,
      };
    });
    this.sendQuery();
  };

  handleResetFilters = async () => {
    const {filterResponse: {filterData}} = this.state;

    let weightCapacityInitialMin = 0;
    let weightCapacityInitialMax = 0;
    let weightCapacity = {min: weightCapacityInitialMin, max: weightCapacityInitialMax};
    let engineTypes = {};

    if (filterData) {
      weightCapacityInitialMin = filterData.capacity_range.min_capacity;
      weightCapacityInitialMax = filterData.capacity_range.max_capacity;
      weightCapacity = {min: weightCapacityInitialMin, max: weightCapacityInitialMax};
      engineTypes = getFilteredEnergyTypesVariantsToStateFormat(filterData.energy_types_variants);
    }

    const resetStateData = {
      weightCapacityInitialMin,
      weightCapacityInitialMax,
      weightCapacity,
      engineTypes,
      brands: stateFieldNameToDropDownParams[StateFieldNameBrands].defaultValue,
      truckQuantity: stateFieldNameToDropDownParams[StateFieldNameTruckQuantity].defaultValue,
      models: null,
      forkLengthDimension: "",
      widthDimension: "",
      liftLengthDimension: "",
      overallHeightDimension: "",
    };

    await this.setState((prevState) => {
      const resetQuery = getResetParams({...prevState, ...resetStateData});
      return {
        ...resetStateData,
        query: resetQuery,
      };
    });

    this.sendQuery();
  };

  handleStartNewSearch = async () => {
    await this.handleModalProductCartCompleted();
    this.handleResetFilters();
  };

  handleFilterButtons = async (id, fieldName) => {
    if (!id || !this.state.hasOwnProperty([fieldName]) || !this.state[fieldName].hasOwnProperty([id])) {
      return;
    }
    const idFormatted = String(id);

    try {
      await this.setState((prevState) => {
        const newFieldState = {};
        for (let prop in prevState[fieldName]) {
          if (prop === idFormatted) {
            newFieldState[prop] = !prevState[fieldName][id];
          } else {
            newFieldState[prop] = false;
          }
        }
        const updatedQuery = getUpdatedQuery(fieldName, this.state.query, newFieldState);
        return {
          [fieldName]: newFieldState,
          query: updatedQuery,
        };
      });
      await this.sendQuery();
    }catch (error) {
      throw new Error(`handleFilterButtons ${error.message}`);
    }
  };

  handleModalProductCartCompleted = () => {
    this.setState((prevState) => {
      return {
        modalVisibilityProductCartCompleted: !prevState.modalVisibilityProductCartCompleted,
      };
    });
  };

  handleOnClickTruckTypeInModal = async (valueData) => {
    await this.handleDropDownFilter(StateFieldNameTruckType)(valueData);
    this.setState((prevState) => {
      return {
        modalVisibilityProductCartCompleted: !prevState.modalVisibilityProductCartCompleted,
        position: false,
      };
    });
  };
  /**---------- Component's State Handlers END ----------**/

  setURLParamTruckTypes = ({truckType}) => {
    const selectedTrucksParams = getUpdatedTruckTypesParamsStringForURL(truckType, this.props.location.search);
    this.props.history.replace({...this.props.history.location, search: selectedTrucksParams});
  };

  // method for send request
  sendQuery = () => {
    this.props.filterTrucksRequest(getRequestQuery(this.state.query));
  };

  addProductToCart = async (productData) => {
    const {truckTypeToCompleted, truckTypeToExceeded, truckToProducts} = this.props;
    const currentTruckTypeId = getCurrentTruckTypeId(this.state);
    const currentTruckTypeName = getCurrentTruckTypeNameToDisplay(this.state, currentTruckTypeId);
    const cartService = new CartService(currentTruckTypeId);
    const truckTypeToCountDataBefore = this.props.truckTypeToCountData[currentTruckTypeId];
    const isCanAdd = cartService.canAddToCart({
                                                truckTypeToCompleted,
                                                truckTypeToExceeded,
                                                truckToProducts,
                                                productSerial: productData.product.serial
    });
    if (!isCanAdd) { return false; }

    await this.props.addToCartProductAction(productData);

    const truckTypeToCountDataAfter = this.props.truckTypeToCountData[currentTruckTypeId];
    const isSuccess = cartService.isSuccessResult({
      countDataBefore: truckTypeToCountDataBefore,
      countDataAfter: truckTypeToCountDataAfter,
    });

    if (isSuccess) {
      toast.success(
        getMessageTruckCountInCartSuccess(
          truckTypeToCountDataAfter,
          {overallReal: this.props.overallRealQuantity, overallDesired: this.props.overallDesiredQuantity},
          currentTruckTypeName,
          this.props.truckTypeQuantity,
        )
      );
    }
  };

  /**---------- Component's render helpers START ----------**/
  renderTruckDetailsContainer = () => {

    if (this.state.position) {
      const currentTruckTypeId = getCurrentTruckTypeId(this.state);

      return (
        <TruckDetailsContainer
          goBackToFilters={this.goBackToFilters}
          addProductToCart={this.addProductToCart}
          // TODO: remove hardcoded productData
          productData = {{
            truckTypeId: currentTruckTypeId,
            rentalDates: {
              from: formatRentalDateToSend(this.state.rentalDates.from),
              to: formatRentalDateToSend(this.state.rentalDates.to),
            }
          }}
        />
      )
    }
  };
  /**---------- Component's render helpers END ----------**/

  render() {
    const {
      filterResponse,
      truckType,
      engineTypes,
      brands,
      models,
      weightCapacity,
      truckQuantity,
      rentalDates,
      isRangeDayPickerOpen,
      weightCapacityInitialMin,
      weightCapacityInitialMax,
      modalVisibilityProductCartCompleted,
      forkLengthDimension,
      widthDimension,
      liftLengthDimension,
      overallHeightDimension,
    } = this.state;

    const {
      filterTrucksData,
      filterOptionsData,
      cartData,
      truckTypesToChoose,
      truckTypeToCountData,
    } = this.props;

    const productResponse = getParsedProductResponse(filterTrucksData);
    // console.log('this.props.cartData', cartData);
    // console.log('^^^ state', this.state);
    // console.log('^^^ props', this.props);
    // console.log('productsData', productResponse ? productResponse : 'Wait');
    const isProductsLoading = Boolean(filterTrucksData && filterTrucksData.isLoading === true);
    const fetchingProductsError = filterTrucksData.error;
    const fetchingInitError = filterOptionsData.error;
    const currentTruckTypeId = getCurrentTruckTypeId(this.state);

    let truckTypeNamesToChoose = null;
    let realQuantityInTruckType = 0;
    let currentTruckTypeNameToDisplay = '';
    if (modalVisibilityProductCartCompleted) {
      truckTypeNamesToChoose = getTruckTypeNamesToDisplay(this.state, truckTypesToChoose);
      realQuantityInTruckType = getRealQuantityByTruckTypeId(truckTypeToCountData, currentTruckTypeId);
      currentTruckTypeNameToDisplay = getCurrentTruckTypeNameToDisplay(this.state, currentTruckTypeId);
    }

    return (
      <Container>
        <h1>
          <FormattedMessage
            id="Search-Header-Rent a forklift"
            defaultMessage="Rent a forklift"
          />
        </h1>
        <PanelsContainer pose={this.state.position ? 'detailsPanel' : 'filter'}>

          <FilterPaneContainer>
            <FilterPane
              currentTruckTypeId={currentTruckTypeId}
              engineTypesVariants={filterResponse ? filterResponse.filterData.energy_types_variants : null}
              brandsVariants={filterResponse ? filterResponse.filterData.brand_variants : null}
              modelsVariants={filterResponse ? filterResponse.filterData.model_variants : null}
              truckTypeVariants={filterResponse ? filterResponse.filterData.product_type_variants : null}
              weightCapacityInitialMin={weightCapacityInitialMin}
              weightCapacityInitialMax={weightCapacityInitialMax}
              truckQuantityState={truckQuantity}
              truckTypeState={truckType}
              engineTypesState={engineTypes}
              brandsState={brands}
              modelsState={models}
              weightCapacityState={weightCapacity}
              rentalDatesState={rentalDates}
              rangeDayPickerOpenState={isRangeDayPickerOpen}
              forkLengthDimensionState={forkLengthDimension}
              widthDimensionState={widthDimension}
              liftLengthDimensionState={liftLengthDimension}
              overallHeightDimensionState={overallHeightDimension}

              handleDropDownFilter={this.handleDropDownFilter}
              handleDateFilter={this.handleDateFilter}
              handleInputDateChange={this.handleInputDateChange}
              handleBrandsDropDownFilter={this.handleBrandsDropDownFilter}
              handleTruckTypeDropDownFilter={this.handleTruckTypeDropDownFilter}
              handleRangeFilter={this.handleRangeFilter}
              handleRangeDayPickerShowing={this.handleRangeDayPickerShowing}
              handleAfterChangeRangeFilter={this.handleAfterChangeRangeFilter}
              handleFilterButtons={this.handleFilterButtons}
              handleDimensionFilter={this.handleDimensionFilter}
              handleResetFilters={this.handleResetFilters}
            />
          </FilterPaneContainer>

          <ResultsContainer
            productsData={productResponse ? productResponse.productsData : null}
            brandMap={filterResponse ? filterResponse.filterData.brand_map : null}
            locationMap={filterResponse ? filterResponse.filterData.location_map : null}
            productsCount={productResponse ? productResponse.filterData.products_count : null}
            organizationMap={filterResponse ? filterResponse.filterData.organization_map : null}
            dataAttributesMap={filterResponse ? filterResponse.filterData.data_attributes_map : null}
            isProductsLoading={isProductsLoading}
            fetchingProductsError={fetchingProductsError || fetchingInitError}
            selectTruck={this.selectTruck}
            currentTruckTypeId={currentTruckTypeId}
          />

          {this.renderTruckDetailsContainer()}

          <ModalCartInfo
            isOpen={modalVisibilityProductCartCompleted}
            onCloseHandler = {this.handleModalProductCartCompleted}
            onClickItemHandler = {this.handleOnClickTruckTypeInModal}
            title="Congratulations!"
            message={<SuccessMessageModalCartInfo
                        quantity={realQuantityInTruckType}
                        truckTypeName={currentTruckTypeNameToDisplay}
                     />}
            truckTypeListTitle="Select the truck type you would like to search next: "
            bottomText={<BottomTextModalCartInfo onNewSearchHandler={this.handleStartNewSearch} />}
            firstBtnTitle="View Cart"
            truckTypesCollection = {getTruckTypesCollectionToChoose(truckTypesToChoose, truckTypeNamesToChoose)}
          />

        </PanelsContainer>

        <div id="filter"></div>
        <div id="fixed"></div>
      </Container>
    );
  }
}

const FilterPageConnected = connected(FilterPageBase);
FilterPageConnected.propTypes = propTypes;
FilterPageConnected.defaultProps = defaultProps;

// Create a new component that is "connected" (to borrow redux
// terminology) to the router.
export const FilterPage = withRouter(FilterPageConnected);